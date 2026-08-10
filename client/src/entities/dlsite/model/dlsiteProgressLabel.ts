import type { DlsiteBulkProgressSnapshot, DlsiteBulkProgressWork } from "@mimimilli/shared";

const LABEL = "DLsiteから取得中";

export function formatDlsiteBulkProgressLabel(progress: DlsiteBulkProgressSnapshot | null): string {
  if (!progress || progress.total === 0) return `${LABEL}...`;
  return `${LABEL} (${progress.processed}/${progress.total})`;
}

export function formatDlsiteBulkWorkLabel(work: DlsiteBulkProgressWork | null): string | null {
  if (!work) return null;
  return work.title.trim() || work.rjCode;
}
