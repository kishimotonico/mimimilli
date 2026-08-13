import type { DlsiteBulkApplyMissingResult } from "@mimimilli/shared";

export function formatDlsiteBulkApplyMissingResult(result: DlsiteBulkApplyMissingResult): string {
  return `適用 ${result.applied}件・スキップ ${result.skipped}件・失敗 ${result.failed}件`;
}
