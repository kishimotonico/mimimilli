/** ADR-0008の重複ID修復における所有者判定の根拠となる安定順の比較関数。 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "ja", { numeric: true, sensitivity: "base" });
}
