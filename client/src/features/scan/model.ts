// スキャン結果・進捗表示の型はsharedのジョブ契約を正典としてre-exportする。
import type { ScanPhase } from "@mimimilli/shared";

export type { ScanResult, ScanPhase, ScanProgressEvent } from "@mimimilli/shared";

/** job scoped SSEのprogressイベントから抜き出した表示用の状態 */
export interface ScanProgress {
  phase: ScanPhase;
  processed: number;
  total: number;
}

/** スキャンのフェーズ進行順。スキャンモーダルの実行中フェーズ表示に使う（TASK-56） */
export const SCAN_PHASE_ORDER: readonly ScanPhase[] = [
  "walking",
  "registering",
  "generating",
  "finalizing",
];

const PHASE_LABEL: Record<ScanPhase, string> = {
  walking: "フォルダーを走査中",
  registering: "作品を登録中",
  generating: "新規作品を検出中",
  finalizing: "仕上げ中",
};

export function scanPhaseLabel(phase: ScanPhase): string {
  return PHASE_LABEL[phase];
}

/** 進捗表示用の短いラベルを組み立てる（例: "作品を登録中 (3/12)"）。total=0 は件数不定を表す */
export function formatScanProgressLabel(progress: ScanProgress | null): string | null {
  if (!progress) return null;
  const label = PHASE_LABEL[progress.phase];
  if (progress.total === 0) return `${label}...`;
  return `${label} (${progress.processed}/${progress.total})`;
}
