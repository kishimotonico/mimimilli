import type { ScanPhase } from "@mimimilli/shared";

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

export function scanPhaseLabel(phase: ScanPhase): string {
  return PHASE_LABEL[phase];
}

export function formatScanProgressLabel(progress: ScanProgress | null): string | null {
  if (!progress) return null;
  const label = PHASE_LABEL[progress.phase];
  if (progress.total === 0) return `${label}...`;
  return `${label} (${progress.processed}/${progress.total})`;
}
