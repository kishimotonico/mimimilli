import type { DlsiteBulkResult } from "@mimimilli/shared";

export function formatDlsiteBulkResult(result: DlsiteBulkResult): string {
  const base = `取得 ${result.fetched}件・失敗 ${result.failed}件`;
  return result.parseErrors > 0 ? `${base}（うちパース ${result.parseErrors}件）` : base;
}
