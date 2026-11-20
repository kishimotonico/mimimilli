import { DLSITE_FETCH_ESTIMATE_MS_PER_CODE } from "@mimimilli/shared";
import type { DlsiteJobState } from "./dlsiteJobStore";

export type DlsiteFetchFrame =
  | { kind: "idle" }
  | {
      kind: "progress";
      processed: number;
      total: number;
      remainingMs: number;
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
      remainingMs: state.starting.total * DLSITE_FETCH_ESTIMATE_MS_PER_CODE,
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
    remainingMs: (job.progress.total - job.progress.processed) * DLSITE_FETCH_ESTIMATE_MS_PER_CODE,
    cancellable: hasQueued && !state.cancelling,
  };
}

/** 取得にかかる時間の目安。1分未満は秒、以上は分（四捨五入） */
export function formatDlsiteFetchEstimate(ms: number): string {
  if (ms < 60_000) return `約${Math.max(1, Math.ceil(ms / 1000))}秒`;
  return `約${Math.round(ms / 60_000)}分`;
}
