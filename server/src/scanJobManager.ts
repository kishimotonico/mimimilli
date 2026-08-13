import { randomUUID } from "node:crypto";
import type {
  ScanJobEvent,
  ScanJobSnapshot,
  ScanLastResultResponse,
  ScanDiagnostic,
  ScanCandidate,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
  ScanProgressEvent,
  ScanResult,
} from "@mimimilli/shared";
import type { DataAdapter } from "./adapter/index.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";

const scanLogger = getCategoryLogger("scan");
const UNREADABLE_PATH_LOG_SAMPLE_LIMIT = 10;

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
  private runCompletion: Promise<void> | null = null;
  private shuttingDown = false;
  // terminal job はpruneTerminalで消えるため、前回結果はディスク永続化せずここにだけ保持する（TASK-56）。
  private lastCompleted: ScanLastResultResponse | null = null;

  constructor(adapter: DataAdapter, historyLimit = 128, terminalLimit = 16) {
    this.adapter = adapter;
    this.historyLimit = historyLimit;
    this.terminalLimit = terminalLimit;
  }

  start(options?: { full?: boolean }): ScanJobSnapshot {
    if (this.shuttingDown) throw new Error("スキャンジョブマネージャーは終了処理中です");
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
    const completion = new Promise<void>((resolve) => {
      setTimeout(() => {
        void this.run(job)
          .catch((error: unknown) => {
            this.finishFailed(job, error);
          })
          .finally(resolve);
      }, 0);
    });
    this.runCompletion = completion;
    void completion.finally(() => {
      if (this.runCompletion === completion) this.runCompletion = null;
    });
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

  async listDiagnostics(): Promise<ScanDiagnostic[]> {
    return this.adapter.listScanDiagnostics();
  }

  async listCandidates(): Promise<ScanCandidate[]> {
    return this.adapter.listScanCandidates();
  }

  async registerCandidates(
    items: ScanCandidateRegisterItem[],
    onRegistered: (workId: string) => void,
  ): Promise<ScanCandidatesRegisterResponse> {
    return this.adapter.registerScanCandidates(items, onRegistered);
  }

  async excludeCandidates(paths: string[]): Promise<void> {
    await this.adapter.excludeScanCandidates(paths);
  }

  async listCandidateExclusions(): Promise<string[]> {
    return this.adapter.listScanCandidateExclusions();
  }

  async restoreCandidateExclusions(paths: string[]): Promise<void> {
    await this.adapter.restoreScanCandidateExclusions(paths);
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

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      await this.runCompletion;
      return;
    }
    this.shuttingDown = true;
    if (this.activeId) this.cancel(this.activeId);
    await this.runCompletion;
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
      const settings = await this.adapter.getSettings();
      scanLogger.info("スキャンを開始しました", {
        jobId: job.snapshot.id,
        full: job.full,
        rootFolder: settings.rootFolder,
      });
      if (job.controller.signal.aborted) return this.finishCancelled(job);
      const result = await this.adapter.scan({
        full: job.full,
        signal: job.controller.signal,
        onProgress: (event) => this.progress(job, event),
      });
      if (job.controller.signal.aborted) this.finishCancelled(job);
      else this.finishCompleted(job, result);
    } catch (error) {
      if (job.controller.signal.aborted) this.finishCancelled(job);
      else this.finishFailed(job, error);
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
    this.logScanCompleted(job, result);
    this.emit(job, { type: "completed", seq: 0, result });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private finishFailed(job: Job, error: unknown): void {
    if (this.isTerminal(job)) return;
    if (job.controller.signal.aborted) {
      this.finishCancelled(job);
      return;
    }
    const message = error instanceof Error ? error.message : "サーバー内部エラーが発生しました";
    job.snapshot.status = "failed";
    job.snapshot.error = message;
    job.snapshot.finishedAt = new Date().toISOString();
    scanLogger.error("スキャンに失敗しました", {
      jobId: job.snapshot.id,
      durationMs: this.durationMs(job),
      ...formatError(error),
    });
    this.emit(job, { type: "failed", seq: 0, error: message });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private finishCancelled(job: Job): void {
    if (this.isTerminal(job)) return;
    job.snapshot.status = "cancelled";
    job.snapshot.finishedAt = new Date().toISOString();
    scanLogger.info("スキャンを取り消しました", {
      jobId: job.snapshot.id,
      durationMs: this.durationMs(job),
    });
    this.emit(job, { type: "cancelled", seq: 0 });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private durationMs(job: Job): number {
    const startedAt = job.snapshot.startedAt ?? job.snapshot.createdAt;
    return Date.now() - Date.parse(startedAt);
  }

  private logScanCompleted(job: Job, result: ScanResult): void {
    const unreadablePaths = result.unreadablePaths ?? [];
    scanLogger.info("スキャンが完了しました", {
      jobId: job.snapshot.id,
      durationMs: this.durationMs(job),
      registered: result.registered,
      insertedWorkIdsCount: result.insertedWorkIds.length,
      updatedWorkIdsCount: result.updatedWorkIds.length,
      errors: result.errors,
      missing: result.missing,
      skipped: result.skipped,
      coverErrors: result.coverErrors,
      rjCodeMissingCount: result.rjCodeMissingCount,
      identityConflictsCount: result.identityConflicts.length,
      unreadablePathsCount: unreadablePaths.length,
      unreadablePathsSample: unreadablePaths.slice(0, UNREADABLE_PATH_LOG_SAMPLE_LIMIT),
      dataIntegrityWarning: result.dataIntegrityWarning !== undefined,
    });
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
