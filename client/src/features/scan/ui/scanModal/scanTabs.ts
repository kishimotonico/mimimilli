import type { ScanCandidatesResponse, ScanRecord } from "@mimimilli/shared";
import { SCAN_TAB_ORDER, type ScanTabKey } from "./types";

/** 件数が分からない（読み込み中・読み込み失敗）は null */
export type ScanTabCounts = Record<ScanTabKey, number | null>;

/** 件数が読み込み中のタブ。読み込み失敗は含めない（件数不明として着地の規則から外れる） */
export type ScanTabPending = Record<ScanTabKey, boolean>;

/** SCAN_TAB_ORDER の順に先頭から見て、件数が読み込み中のタブに当たったら null（まだ決められない）、件数のあるタブに当たったらそのタブ。
 *  どれも0または不明なら未登録 */
export function landingTab(counts: ScanTabCounts, pending: ScanTabPending): ScanTabKey | null {
  for (const tab of SCAN_TAB_ORDER) {
    if (pending[tab]) return null;
    if ((counts[tab] ?? 0) > 0) return tab;
  }
  return "unregistered";
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
