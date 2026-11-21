import type { ScanCandidatesResponse, ScanRecord } from "@mimimilli/shared";
import { SCAN_TAB_ORDER, type ScanTabKey } from "./types";

/** 件数が分からない（読み込み中・読み込み失敗）は null */
export type ScanTabCounts = Record<ScanTabKey, number | null>;

/** 件数のあるタブを SCAN_TAB_ORDER の順に探す。どれも0なら未登録 */
export function landingTab(counts: ScanTabCounts): ScanTabKey {
  return SCAN_TAB_ORDER.find((tab) => (counts[tab] ?? 0) > 0) ?? "unregistered";
}

export interface ScanTabSources {
  candidates: ScanCandidatesResponse | undefined;
  /** 要対応の行数。診断を読めるまでは undefined */
  needsAttention: number | undefined;
  newCount: number | undefined;
  record: ScanRecord | undefined;
}

export function computeScanTabCounts({
  candidates,
  needsAttention,
  newCount,
  record,
}: ScanTabSources): ScanTabCounts {
  return {
    unregistered: candidates ? candidates.candidates.length : null,
    needsAttention: needsAttention ?? null,
    newWorks: newCount ?? null,
    updated: record ? record.updatedWorks.length : null,
  };
}
