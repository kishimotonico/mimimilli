import { randomUUID } from "node:crypto";
import type {
  ScanJobEvent,
  ScanJobSnapshot,
  ScanDiagnostics,
  ScanProgressEvent,
  ScanResult,
} from "@mimimilli/shared";
import type { DataAdapter, ScanExecution } from "./adapter/index.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";
import { ScanSession } from "./scanSession.ts";

const scanLogger = getCategoryLogger("scan");
const UNREADABLE_PATH_LOG_SAMPLE_LIMIT = 10;

type Listener = (event: ScanJobEvent) => void;

interface Job {
  snapshot: ScanJobSnapshot;
  controller: AbortController;
  listeners: Set<Listener>;
  full: boolean;
}

export class ActiveScanConflictError extends Error {
  readonly active: ScanJobSnapshot;

  constructor(active: ScanJobSnapshot) {
    super("スキャンは既に実行中です。完了をお待ちください");
    this.active = active;
  }
}

export interface ScanJobManagerOptions {
  terminalLimit?: number;
  session?: ScanSession;
}

export class ScanJobManager {
  private readonly adapter: DataAdapter;
  private readonly terminalLimit: number;
  private readonly jobs = new Map<string, Job>();
  private activeId: string | null = null;
  private runCompletion: Promise<void> | null = null;
  private shuttingDown = false;
  /** 直近のスキャンの結果（候補・記録）。ジョブの完了で公開する。 */
  readonly session: ScanSession;

  constructor(adapter: DataAdapter, options: ScanJobManagerOptions = {}) {
    this.adapter = adapter;
    this.session = options.session ?? new ScanSession(adapter);
    this.terminalLimit = options.terminalLimit ?? 16;
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
      error: null,
    };
    const job: Job = {
      snapshot,
      controller: new AbortController(),
      listeners: new Set(),
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

  async listDiagnostics(): Promise<ScanDiagnostics> {
    return this.adapter.listScanDiagnostics();
  }

  cancel(id: string): ScanJobSnapshot | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    if (this.isTerminal(job)) return this.copy(job.snapshot);
    if (job.snapshot.status !== "cancelling") {
      job.snapshot.status = "cancelling";
      this.emit(job, { type: "state", snapshot: this.copy(job.snapshot) });
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

  async cancelActiveAndAwait(): Promise<void> {
    if (this.activeId) this.cancel(this.activeId);
    await this.runCompletion;
  }

  /** 現在snapshotの取得とlistener登録を同期的に行う。終端済みならlistenerは登録しない。 */
  subscribe(
    id: string,
    listener: Listener,
  ): { snapshot: ScanJobSnapshot; unsubscribe(): void } | null {
    const job = this.jobs.get(id);
    if (!job) return null;
    const snapshot = this.copy(job.snapshot);
    if (this.isTerminal(job)) return { snapshot, unsubscribe: () => {} };
    job.listeners.add(listener);
    return { snapshot, unsubscribe: () => job.listeners.delete(listener) };
  }

  private async run(job: Job): Promise<void> {
    if (job.controller.signal.aborted) return this.finishCancelled(job);
    job.snapshot.status = "running";
    job.snapshot.startedAt = new Date().toISOString();
    this.session.record.beginScan();
    this.emit(job, { type: "state", snapshot: this.copy(job.snapshot) });
    try {
      const settings = await this.adapter.getSettings();
      scanLogger.info("スキャンを開始しました", {
        jobId: job.snapshot.id,
        full: job.full,
        rootFolder: settings.rootFolder,
      });
      if (job.controller.signal.aborted) return this.finishCancelled(job);
      const execution = await this.adapter.scan({
        full: job.full,
        signal: job.controller.signal,
        onProgress: (event) => this.progress(job, event),
      });
      if (job.controller.signal.aborted) this.finishCancelled(job);
      else this.finishCompleted(job, execution);
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
    this.emit(job, { type: "progress", progress: job.snapshot.progress });
  }

  private finishCompleted(job: Job, execution: ScanExecution): void {
    if (this.isTerminal(job) || job.controller.signal.aborted) {
      this.finishCancelled(job);
      return;
    }
    job.snapshot.status = "completed";
    job.snapshot.finishedAt = new Date().toISOString();
    this.session.publish(execution, job.snapshot.finishedAt);
    this.logScanCompleted(job, execution.result);
    this.emit(job, { type: "completed", finishedAt: job.snapshot.finishedAt });
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
    this.session.record.endScan();
    job.snapshot.status = "failed";
    job.snapshot.error = message;
    job.snapshot.finishedAt = new Date().toISOString();
    scanLogger.error("スキャンに失敗しました", {
      jobId: job.snapshot.id,
      durationMs: this.durationMs(job),
      ...formatError(error),
    });
    this.emit(job, { type: "failed", error: message });
    this.deactivate(job);
    this.pruneTerminal();
  }

  private finishCancelled(job: Job): void {
    if (this.isTerminal(job)) return;
    this.session.record.endScan();
    job.snapshot.status = "cancelled";
    job.snapshot.finishedAt = new Date().toISOString();
    scanLogger.info("スキャンを取り消しました", {
      jobId: job.snapshot.id,
      durationMs: this.durationMs(job),
    });
    this.emit(job, { type: "cancelled" });
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
      updatedWorksCount: result.updatedWorks.length,
      errors: result.errors,
      missing: result.missing,
      skipped: result.skipped,
      coverErrors: result.coverErrors,
      unreadablePathsCount: unreadablePaths.length,
      unreadablePathsSample: unreadablePaths.slice(0, UNREADABLE_PATH_LOG_SAMPLE_LIMIT),
      dataIntegrityWarning: result.dataIntegrityWarning !== undefined,
    });
  }

  private emit(job: Job, event: ScanJobEvent): void {
    for (const listener of job.listeners) listener(event);
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
