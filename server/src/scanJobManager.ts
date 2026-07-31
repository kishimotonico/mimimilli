import { randomUUID } from "node:crypto";
import type {
  ScanJobEvent,
  ScanJobSnapshot,
  ScanLastResultResponse,
  ScanProgressEvent,
  ScanResult,
} from "@mimimilli/shared";
import type { DataAdapter } from "./adapter.ts";
import { enqueueDlsiteJob } from "./routes/dlsiteProgress.ts";

type Listener = (event: ScanJobEvent) => void;

interface Job {
  snapshot: ScanJobSnapshot;
  controller: AbortController;
  listeners: Set<Listener>;
  history: ScanJobEvent[];
  nextSeq: number;
  full: boolean;
}

export class ActiveScanConflictError extends Error {
  readonly active: ScanJobSnapshot;

  constructor(active: ScanJobSnapshot) {
    super("スキャンは既に実行中です。完了をお待ちください");
    this.active = active;
  }
}

export class ScanJobManager {
  private readonly adapter: DataAdapter;
  private readonly historyLimit: number;
  private readonly terminalLimit: number;
  private readonly jobs = new Map<string, Job>();
  private activeId: string | null = null;
  // terminal job はpruneTerminalで消えるため、前回結果はディスク永続化せずここにだけ保持する（TASK-56）。
  private lastCompleted: ScanLastResultResponse | null = null;

  constructor(adapter: DataAdapter, historyLimit = 128, terminalLimit = 16) {
    this.adapter = adapter;
    this.historyLimit = historyLimit;
    this.terminalLimit = terminalLimit;
  }

  start(options?: { full?: boolean }): ScanJobSnapshot {
    const active = this.getActive();
    if (active) throw new ActiveScanConflictError(active);
    const full = options?.full ?? false;
    const snapshot: ScanJobSnapshot = {
      id: randomUUID(),
      status: "queued",
      createdAt: new Date().toISOString(),
      startedAt: null,
      finishedAt: null,
      progress: null,
      result: null,
      error: null,
    };
    const job: Job = {
      snapshot,
      controller: new AbortController(),
      listeners: new Set(),
      history: [],
      nextSeq: 1,
      full,
    };
    this.jobs.set(snapshot.id, job);
    this.activeId = snapshot.id;

    // POSTのcall stackからscan開始を分離する。同期adapterであってもqueued応答を先に返す。
    setTimeout(() => {
      void this.run(job).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "サーバー内部エラーが発生しました";
        this.finishFailed(job, message);
      });
    }, 0);
    return this.copy(snapshot);
  }

  get(id: string): ScanJobSnapshot | null {
    const job = this.jobs.get(id);
    return job ? this.copy(job.snapshot) : null;
  }

  getActive(): ScanJobSnapshot | null {
    if (!this.activeId) return null;
    return this.get(this.activeId);
  }

  getLastCompleted(): ScanLastResultResponse | null {
    return this.lastCompleted ? structuredClone(this.lastCompleted) : null;
  }

  cancel(id: string): ScanJobSnapshot | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (this.isTerminal(job)) return this.copy(job.snapshot);
    if (job.snapshot.status !== "cancelling") {
      job.snapshot.status = "cancelling";
      this.emit(job, { type: "state", seq: 0, snapshot: this.copy(job.snapshot) });
    }
    job.controller.abort();
    return this.copy(job.snapshot);
  }

  subscribe(
    id: string,
    lastEventId: number | null,
    listener: Listener,
  ): {
    unsubscribe(): void;
    initial: ScanJobEvent[];
    snapshot: ScanJobSnapshot;
  } | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    job.listeners.add(listener);
    const first = job.history[0]?.seq;
    const initial: ScanJobEvent[] = [];
    if (lastEventId !== null && first !== undefined && lastEventId < first - 1) {
      // reset snapshotは現在状態を包含するため、その時点の全event watermarkをIDにする。
      // first-1ではreset後の再接続時に古いretained historyを再適用してしまう。
      initial.push({
        type: "reset",
        seq: job.nextSeq - 1,
        snapshot: this.copy(job.snapshot),
      });
    } else {
      for (const event of job.history) {
        if (lastEventId === null || event.seq > lastEventId) initial.push(event);
      }
    }
    return {
      initial,
      snapshot: this.copy(job.snapshot),
      unsubscribe: () => job.listeners.delete(listener),
    };
  }

  private async run(job: Job): Promise<void> {
    if (job.controller.signal.aborted) return this.finishCancelled(job);
    job.snapshot.status = "running";
    job.snapshot.startedAt = new Date().toISOString();
    this.emit(job, { type: "state", seq: 0, snapshot: this.copy(job.snapshot) });
    try {
      const result = await this.adapter.scan({
        full: job.full,
        signal: job.controller.signal,
        onProgress: (event) => this.progress(job, event),
      });
      if (job.controller.signal.aborted) this.finishCancelled(job);
      else this.finishCompleted(job, result);
    } catch (error) {
      if (job.controller.signal.aborted) this.finishCancelled(job);
      else throw error;
    }
  }

  private progress(job: Job, event: ScanProgressEvent): void {
    if (
      job.controller.signal.aborted ||
      job.snapshot.status !== "running" ||
      event.type !== "progress"
    ) {
      return;
    }
    job.snapshot.progress = {
      phase: event.phase,
      processed: event.processed,
      total: event.total,
    };
    this.emit(job, { type: "progress", seq: 0, progress: job.snapshot.progress });
  }

  private finishCompleted(job: Job, result: ScanResult): void {
    if (this.isTerminal(job) || job.controller.signal.aborted) {
      this.finishCancelled(job);
      return;
    }
    job.snapshot.status = "completed";
    job.snapshot.result = result;
    job.snapshot.finishedAt = new Date().toISOString();
    this.lastCompleted = { result, finishedAt: job.snapshot.finishedAt };
    this.emit(job, { type: "completed", seq: 0, result });
    this.deactivate(job);
    this.pruneTerminal();
    if (result.newWorkIds.length > 0) {
      enqueueDlsiteJob(this.adapter, "new", result.newWorkIds);
    }
  }

  private finishFailed(job: Job, error: string): void {
    if (this.isTerminal(job)) return;
    if (job.controller.signal.aborted) {
      this.finishCancelled(job);
      return;
    }
    job.snapshot.status = "failed";
    job.snapshot.error = error;
    job.snapshot.finishedAt = new Date().toISOString();
    this.emit(job, { type: "failed", seq: 0, error });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private finishCancelled(job: Job): void {
    if (this.isTerminal(job)) return;
    job.snapshot.status = "cancelled";
    job.snapshot.finishedAt = new Date().toISOString();
    this.emit(job, { type: "cancelled", seq: 0 });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private emit(job: Job, event: ScanJobEvent): void {
    const assigned = { ...event, seq: job.nextSeq++ } as ScanJobEvent;
    job.history.push(assigned);
    if (job.history.length > this.historyLimit) {
      job.history.splice(0, job.history.length - this.historyLimit);
    }
    for (const listener of job.listeners) listener(assigned);
  }

  private deactivate(job: Job): void {
    if (this.activeId === job.snapshot.id) this.activeId = null;
  }

  private isTerminal(job: Job): boolean {
    return ["completed", "failed", "cancelled"].includes(job.snapshot.status);
  }

  private copy(snapshot: ScanJobSnapshot): ScanJobSnapshot {
    return structuredClone(snapshot);
  }

  private pruneTerminal(): void {
    const terminal = [...this.jobs.values()]
      .filter((job) => this.isTerminal(job))
      .sort((a, b) => a.snapshot.createdAt.localeCompare(b.snapshot.createdAt));
    while (terminal.length > this.terminalLimit) {
      this.jobs.delete(terminal.shift()!.snapshot.id);
    }
  }
}
