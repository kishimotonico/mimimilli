import type { DlsiteJobState } from "./dlsiteJobStore";

export type DlsiteFetchFrame =
  | { kind: "idle" }
  | {
      kind: "progress";
      processed: number;
      total: number;
      cancellable: boolean;
    };

type FrameJobState = Pick<DlsiteJobState, "job" | "starting" | "cancelling">;

/** 取得の枠。ジョブのコードをすべて数える。 */
export function dlsiteFetchFrame(state: FrameJobState): DlsiteFetchFrame {
  if (state.starting) {
    return {
      kind: "progress",
      processed: 0,
      total: state.starting.total,
      cancellable: false,
    };
  }
  const { job } = state;
  if (!job || job.status !== "running" || job.progress.processed >= job.progress.total) {
    return { kind: "idle" };
  }
  const hasQueued = [...job.codes.values()].some((entry) => entry.state === "queued");
  return {
    kind: "progress",
    processed: job.progress.processed,
    total: job.progress.total,
    cancellable: hasQueued && !state.cancelling,
  };
}
