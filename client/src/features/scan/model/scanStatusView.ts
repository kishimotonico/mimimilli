import type { ScanJobSnapshot } from "@mimimilli/shared";
import type { ScanProgress } from "../model";

/** サイドバーの状態欄が出す6状態。まだスキャンしていない待機は at が null。失敗は日時を持たない。 */
export type ScanStatusView =
  | { kind: "idle"; at: string | null }
  | { kind: "running"; progress: ScanProgress | null }
  | { kind: "cancelling"; progress: ScanProgress | null }
  | { kind: "completed"; at: string | null }
  | { kind: "cancelled"; at: string | null }
  | { kind: "failed"; reason: string };

export const SCAN_FAILED_FALLBACK_REASON = "原因は不明です";

/** 完了は短いあいだだけ出して待機へ戻す。中止と失敗は次のスキャンまで残す。 */
export function deriveScanStatusView(
  job: ScanJobSnapshot | null,
  lastScanTime: string | null,
  showCompleted: boolean,
): ScanStatusView {
  if (job === null) return { kind: "idle", at: lastScanTime };
  switch (job.status) {
    case "queued":
    case "running":
      return { kind: "running", progress: job.progress };
    case "cancelling":
      return { kind: "cancelling", progress: job.progress };
    case "completed":
      return showCompleted
        ? { kind: "completed", at: job.finishedAt ?? lastScanTime }
        : { kind: "idle", at: lastScanTime };
    case "cancelled":
      return { kind: "cancelled", at: job.finishedAt ?? lastScanTime };
    case "failed":
      return {
        kind: "failed",
        reason: job.error ?? SCAN_FAILED_FALLBACK_REASON,
      };
  }
}
