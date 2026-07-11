import type { DlsiteBulkProgressEvent } from "@mimimilli/shared";

type Listener = (event: DlsiteBulkProgressEvent) => void;
type Progress = Extract<DlsiteBulkProgressEvent, { type: "progress" }>;
type Terminal = Extract<DlsiteBulkProgressEvent, { type: "complete" | "error" }>;

let currentJob: { listeners: Set<Listener>; lastProgress: Progress | null } | null = null;
let lastTerminal: Terminal | null = null;

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

export function resetDlsiteProgressStateForTest(): void {
  currentJob = null;
  lastTerminal = null;
}
