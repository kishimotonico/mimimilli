import type { DlsiteBulkMode, DlsiteBulkProgressEvent } from "@mimimilli/shared";
import type { DataAdapter } from "../adapter.ts";

type Listener = (event: DlsiteBulkProgressEvent) => void;
type Progress = Extract<DlsiteBulkProgressEvent, { type: "progress" }>;
type Terminal = Extract<DlsiteBulkProgressEvent, { type: "complete" | "error" }>;

let currentJob: { listeners: Set<Listener>; lastProgress: Progress | null } | null = null;
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

export function startDlsiteJob() {
  const job = { listeners: new Set<Listener>(), lastProgress: null as Progress | null };
  currentJob = job;
  lastTerminal = null;
  return {
    emit(event: DlsiteBulkProgressEvent) {
      if (event.type === "progress") job.lastProgress = event;
      else lastTerminal = event;
      for (const listener of job.listeners) listener(event);
    },
    finish() {
      if (currentJob === job) currentJob = null;
    },
  };
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
        const result = await next.adapter.runDlsiteBulk(next.mode, next.workIds, (event) =>
          job.emit(event),
        );
        job.emit({ type: "complete", result });
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
