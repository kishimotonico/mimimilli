// スキャン結果・進捗表示の型はsharedのジョブ契約を正典としてre-exportする。
import type { ScanPhase, ScanResult } from "@mimimilli/shared";

export type { ScanResult, ScanPhase, ScanProgressEvent } from "@mimimilli/shared";

/** スキャン完了ポップアップ（NewWorkPopup）を表示するか。新規作品0件のスキャンでは
 *  表示せず、通知ベルのサマリ表示だけに留める（TASK-44） */
export function shouldShowNewWorkPopup(scanResult: ScanResult | null): scanResult is ScanResult {
  return scanResult !== null && scanResult.newlyGenerated > 0;
}

/** job scoped SSEのprogressイベントから抜き出した表示用の状態 */
export interface ScanProgress {
  phase: ScanPhase;
  processed: number;
  total: number;
}

const PHASE_LABEL: Record<ScanPhase, string> = {
  walking: "フォルダーを走査中",
  registering: "作品を登録中",
  generating: "新規作品を検出中",
  finalizing: "仕上げ中",
};

/** 進捗表示用の短いラベルを組み立てる（例: "作品を登録中 (3/12)"）。total=0 は件数不定を表す */
export function formatScanProgressLabel(progress: ScanProgress | null): string | null {
  if (!progress) return null;
  const label = PHASE_LABEL[progress.phase];
  if (progress.total === 0) return `${label}...`;
  return `${label} (${progress.processed}/${progress.total})`;
}
