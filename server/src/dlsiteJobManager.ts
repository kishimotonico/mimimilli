import { randomUUID } from "node:crypto";
import type {
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkSnapshot,
  DlsiteBulkTerminal,
} from "@mimimilli/shared";
import type { DataAdapter } from "./adapter/index.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

type Listener = (event: DlsiteBulkProgressEvent) => void;
type Progress = Extract<DlsiteBulkProgressEvent, { type: "progress" }>;
type Terminal = Extract<DlsiteBulkProgressEvent, { type: "complete" | "cancelled" | "error" }>;

interface ActiveJob {
  jobId: string;
  listeners: Set<Listener>;
  lastProgress: Progress | null;
  controller: AbortController;
  cancelling: boolean;
  emit(event: DlsiteBulkProgressEvent): void;
  finish(): void;
}

interface PendingJob {
  jobId: string;
  mode: DlsiteBulkMode;
  workIds: string[] | undefined;
}

export class DlsiteJobManager {
  private readonly adapter: DataAdapter;
  private currentJob: ActiveJob | null = null;
  private lastTerminal: Terminal | null = null;
  private readonly pendingJobs: PendingJob[] = [];
  private processingQueue = false;
  private queueDrain: Promise<void> | null = null;
  private shuttingDown = false;

  constructor(adapter: DataAdapter) {
    this.adapter = adapter;
  }

  isInProgress(): boolean {
    return this.currentJob !== null;
  }

  getSnapshot(): DlsiteBulkSnapshot {
    const job = this.currentJob;
    const current = job
      ? {
          jobId: job.jobId,
          status: job.cancelling ? ("cancelling" as const) : ("running" as const),
          progress: job.lastProgress
            ? {
                processed: job.lastProgress.processed,
                total: job.lastProgress.total,
                work: job.lastProgress.work,
              }
            : null,
        }
      : null;
    return { current, lastTerminal: this.lastTerminal ? toTerminal(this.lastTerminal) : null };
  }

  startJob(jobId: string): ActiveJob {
    const listeners = new Set<Listener>();
    const controller = new AbortController();
    const job: ActiveJob = {
      jobId,
      listeners,
      lastProgress: null,
      controller,
      cancelling: false,
      emit: (event) => {
        if (event.type === "progress") job.lastProgress = event;
        else if (event.type !== "cancelling") this.lastTerminal = event;
        for (const listener of listeners) listener(event);
      },
      finish: () => {
        if (this.currentJob === job) this.currentJob = null;
      },
    };
    this.currentJob = job;
    return job;
  }

  cancel(): boolean {
    const job = this.currentJob;
    if (!job) return false;
    this.pendingJobs.length = 0;
    if (!job.cancelling) {
      job.cancelling = true;
      job.emit({ type: "cancelling", jobId: job.jobId });
    }
    job.controller.abort();
    return true;
  }

  subscribe(listener: Listener) {
    if (this.currentJob) {
      const job = this.currentJob;
      job.listeners.add(listener);
      return {
        replay: job.lastProgress ? [job.lastProgress] : [],
        unsubscribe: () => job.listeners.delete(listener),
        isLive: true,
      };
    }
    return {
      replay: this.lastTerminal ? [this.lastTerminal] : [],
      unsubscribe: () => {},
      isLive: false,
    };
  }

  /** 待機キューへ積み、採番したジョブIDを返す。終了処理中は積まずにnullを返す */
  enqueue(mode: DlsiteBulkMode, workIds: string[] | undefined): string | null {
    if (this.shuttingDown) return null;
    const jobId = randomUUID();
    this.pendingJobs.push({ jobId, mode, workIds });
    void this.drainQueue();
    return jobId;
  }

  async shutdown(): Promise<void> {
    if (this.shuttingDown) {
      await this.queueDrain;
      return;
    }
    this.shuttingDown = true;
    this.pendingJobs.length = 0;
    this.cancel();
    if (!this.queueDrain) return;
    try {
      await this.queueDrain;
    } catch (error) {
      dlsiteLogger.error("DLsiteジョブの終了待機中にエラーが発生しました", formatError(error));
      throw error;
    }
  }

  async cancelActiveAndAwait(): Promise<void> {
    this.pendingJobs.length = 0;
    if (this.currentJob) this.cancel();
    if (this.queueDrain) await this.queueDrain;
  }

  private async drainQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;
    const drain = this.runQueue();
    this.queueDrain = drain;
    try {
      await drain;
    } finally {
      if (this.queueDrain === drain) this.queueDrain = null;
      this.processingQueue = false;
    }
  }

  private async runQueue(): Promise<void> {
    while (!this.shuttingDown) {
      const next = this.pendingJobs.shift();
      if (!next) return;
      const job = this.startJob(next.jobId);
      const jobId = job.jobId;
      try {
        const result = await this.adapter.runDlsiteBulk(next.mode, next.workIds, {
          signal: job.controller.signal,
          onProgress: (progress) => job.emit({ type: "progress", jobId, ...progress }),
        });
        if (job.controller.signal.aborted) job.emit({ type: "cancelled", jobId, result });
        else job.emit({ type: "complete", jobId, result });
      } catch (error) {
        const aborted =
          job.controller.signal.aborted ||
          (error instanceof DOMException && error.name === "AbortError");
        if (aborted) {
          job.emit({
            type: "cancelled",
            jobId,
            result: { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 },
          });
        } else {
          job.emit({
            type: "error",
            jobId,
            message: error instanceof Error ? error.message : "DLsite一括取得に失敗しました",
          });
        }
      } finally {
        job.finish();
      }
    }
  }
}

function toTerminal(event: Terminal): DlsiteBulkTerminal {
  if (event.type === "error") {
    return { jobId: event.jobId, status: "error", message: event.message };
  }
  return { jobId: event.jobId, status: event.type, result: event.result };
}
