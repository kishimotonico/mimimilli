import type { DlsiteBulkResult } from "@mimimilli/shared";

export function formatDlsiteBulkResult(result: DlsiteBulkResult): string {
  const base = `取得 ${result.fetched}件・失敗 ${result.failed}件`;
  const withParse = result.parseErrors > 0 ? `${base}（うちパース ${result.parseErrors}件）` : base;
  if (result.dataIntegrityWarning) {
    return `${withParse}・不整合除外 ${result.dataIntegrityWarning.skippedCount}件`;
  }
  return withParse;
}
