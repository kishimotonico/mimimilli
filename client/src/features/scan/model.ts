// スキャン結果・進捗イベント（POST /api/scan、GET /api/scan/events）の型は
// @mimimilli/shared を正典として re-export する。
import type { ScanPhase } from "@mimimilli/shared";

export type { ScanResult, ScanPhase, ScanProgressEvent } from "@mimimilli/shared";

/** GET /api/scan/events の progress イベントから抜き出した表示用の状態 */
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
