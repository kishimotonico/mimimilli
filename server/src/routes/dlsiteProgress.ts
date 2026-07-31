import type {
  DlsiteBulkMode,
  DlsiteBulkProgressEvent,
  DlsiteBulkSnapshot,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";

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

let currentJob: ActiveJob | null = null;
let lastTerminal: Terminal | null = null;
const pendingJobs: Array<{
  adapter: DataAdapter;
  mode: DlsiteBulkMode;
  workIds: string[] | undefined;
}> = [];
let processingQueue = false;

export function isDlsiteJobInProgress(): boolean {
  return currentJob !== null;
}

export function getDlsiteBulkSnapshot(): DlsiteBulkSnapshot | null {
  const job = currentJob;
  if (job) {
    const progress = job.lastProgress
      ? { processed: job.lastProgress.processed, total: job.lastProgress.total }
      : null;
    return { status: job.cancelling ? "cancelling" : "running", progress };
  }
  if (!lastTerminal) return null;
  if (lastTerminal.type === "complete") {
    return { status: "complete", result: lastTerminal.result };
  }
  if (lastTerminal.type === "cancelled") {
    return { status: "cancelled", result: lastTerminal.result };
  }
  return { status: "error", message: lastTerminal.message };
}

export function startDlsiteJob(): ActiveJob {
  const listeners = new Set<Listener>();
  const controller = new AbortController();
  const job: ActiveJob = {
    listeners,
    lastProgress: null,
    controller,
    cancelling: false,
    emit(event) {
      if (event.type === "progress") job.lastProgress = event;
      else if (event.type !== "cancelling") lastTerminal = event;
      for (const listener of listeners) listener(event);
    },
    finish() {
      if (currentJob === job) currentJob = null;
    },
  };
  currentJob = job;
  lastTerminal = null;
  return job;
}

export function cancelDlsiteJob(): boolean {
  const job = currentJob;
  if (!job) return false;
  pendingJobs.length = 0;
  if (!job.cancelling) {
    job.cancelling = true;
    job.emit({ type: "cancelling" });
  }
  job.controller.abort();
  return true;
}

export function subscribeToDlsite(listener: Listener) {
  if (currentJob) {
    const job = currentJob;
    job.listeners.add(listener);
    return {
      replay: job.lastProgress ? [job.lastProgress] : [],
      unsubscribe: () => job.listeners.delete(listener),
      isLive: true,
    };
  }
  return { replay: lastTerminal ? [lastTerminal] : [], unsubscribe: () => {}, isLive: false };
}

/** 手動一括とスキャン後の自動取得を直列実行するFIFO。実行中のジョブがあっても取りこぼさない。 */
export function enqueueDlsiteJob(
  adapter: DataAdapter,
  mode: DlsiteBulkMode,
  workIds: string[] | undefined,
): void {
  pendingJobs.push({ adapter, mode, workIds });
  void drainQueue();
}

async function drainQueue(): Promise<void> {
  if (processingQueue) return;
  processingQueue = true;
  try {
    let next;
    while ((next = pendingJobs.shift())) {
      const job = startDlsiteJob();
      try {
        const result = await next.adapter.runDlsiteBulk(next.mode, next.workIds, {
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
  } finally {
    processingQueue = false;
  }
}

export function resetDlsiteProgressStateForTest(): void {
  currentJob = null;
  lastTerminal = null;
  pendingJobs.length = 0;
  processingQueue = false;
}
