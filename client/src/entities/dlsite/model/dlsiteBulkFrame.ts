import { DLSITE_FETCH_ESTIMATE_MS_PER_CODE } from "@mimimilli/shared";
import type { DlsiteJobState } from "./dlsiteJobStore";

export type DlsiteBulkFrame =
  | { kind: "idle" }
  | {
      kind: "progress";
      processed: number;
      total: number;
      remainingMs: number;
      cancellable: boolean;
    };

type FrameJobState = Pick<DlsiteJobState, "job" | "startingBulk" | "cancelling">;

/** まとめての取得の枠。起点がまとめてのコードだけを数え、単発のコードは入らない。 */
export function dlsiteBulkFrame(state: FrameJobState): DlsiteBulkFrame {
  if (state.startingBulk) {
    return {
      kind: "progress",
      processed: 0,
      total: state.startingBulk.total,
      remainingMs: state.startingBulk.total * DLSITE_FETCH_ESTIMATE_MS_PER_CODE,
      cancellable: false,
    };
  }
  const { job } = state;
  if (!job || job.status !== "running" || job.bulk.processed >= job.bulk.total) {
    return { kind: "idle" };
  }
  const hasQueuedBulk = [...job.codes.values()].some(
    (entry) => entry.origin === "bulk" && entry.state === "queued",
  );
  return {
    kind: "progress",
    processed: job.bulk.processed,
    total: job.bulk.total,
    remainingMs: (job.bulk.total - job.bulk.processed) * DLSITE_FETCH_ESTIMATE_MS_PER_CODE,
    cancellable: hasQueuedBulk && !state.cancelling,
  };
}

/** 取得にかかる時間の目安。1分未満は秒、以上は分（四捨五入） */
export function formatDlsiteFetchEstimate(ms: number): string {
  if (ms < 60_000) return `約${Math.max(1, Math.ceil(ms / 1000))}秒`;
  return `約${Math.round(ms / 60_000)}分`;
}
