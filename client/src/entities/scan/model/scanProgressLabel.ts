import type { ScanPhase, ScanProgress } from "@mimimilli/shared";

export type { ScanProgress };

const PHASE_LABEL: Record<ScanPhase, string> = {
  walking: "フォルダーを走査中",
  reading: "作品情報を読み込み中",
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
