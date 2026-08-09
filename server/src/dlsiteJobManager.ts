import type {
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkSnapshot,
} from "@mimimilli/shared";
import type { DataAdapter } from "./adapter/index.ts";
import { formatError, getCategoryLogger } from "./lib/logger.ts";

const dlsiteLogger = getCategoryLogger("dlsite");

type Listener = (event: DlsiteBulkProgressEvent) => void;
type Progress = Extract<DlsiteBulkProgressEvent, { type: "progress" }>;
type Terminal = Extract<DlsiteBulkProgressEvent, { type: "complete" | "cancelled" | "error" }>;

interface ActiveJob {
  listeners: Set<Listener>;
  lastProgress: Progress | null;
  controller: AbortController;
  cancelling: boolean;
  emit(event: DlsiteBulkProgressEvent): void;
  finish(): void;
}

interface PendingJob {
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

  getSnapshot(): DlsiteBulkSnapshot | null {
    const job = this.currentJob;
    if (job) {
      const progress = job.lastProgress
        ? { processed: job.lastProgress.processed, total: job.lastProgress.total }
        : null;
      return { status: job.cancelling ? "cancelling" : "running", progress };
    }
    if (!this.lastTerminal) return null;
    if (this.lastTerminal.type === "complete") {
      return { status: "complete", result: this.lastTerminal.result };
    }
    if (this.lastTerminal.type === "cancelled") {
      return { status: "cancelled", result: this.lastTerminal.result };
    }
    return { status: "error", message: this.lastTerminal.message };
  }

  startJob(): ActiveJob {
    const listeners = new Set<Listener>();
    const controller = new AbortController();
    const job: ActiveJob = {
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
    this.lastTerminal = null;
    return job;
  }

  cancel(): boolean {
    const job = this.currentJob;
    if (!job) return false;
    this.pendingJobs.length = 0;
    if (!job.cancelling) {
      job.cancelling = true;
      job.emit({ type: "cancelling" });
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

  enqueue(mode: DlsiteBulkMode, workIds: string[] | undefined): void {
    if (this.shuttingDown) return;
    this.pendingJobs.push({ mode, workIds });
    void this.drainQueue();
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
      const job = this.startJob();
      try {
        const result = await this.adapter.runDlsiteBulk(next.mode, next.workIds, {
          signal: job.controller.signal,
          onProgress: (event) => job.emit(event),
        });
        if (job.controller.signal.aborted) job.emit({ type: "cancelled", result });
        else job.emit({ type: "complete", result });
      } catch (error) {
        job.emit({
          type: "error",
          message: error instanceof Error ? error.message : "DLsite一括取得に失敗しました",
        });
      } finally {
        job.finish();
      }
    }
  }
}
