export type ScanListStatus = "loading" | "error" | "notScanned" | "empty" | "ready";

export const NOT_SCANNED_MESSAGE = "スキャン結果はまだありません";

/** 一覧の表示状態。error は読めたデータがないときだけ立てる。notScanned は要対応では使わない。 */
export function deriveScanListStatus(input: {
  loading: boolean;
  error: boolean;
  notScanned?: boolean;
  count: number;
}): ScanListStatus {
  if (input.error) return "error";
  if (input.loading) return "loading";
  if (input.notScanned) return "notScanned";
  return input.count === 0 ? "empty" : "ready";
}
