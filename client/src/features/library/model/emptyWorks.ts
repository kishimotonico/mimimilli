// 作品リストが0件のときの案内メッセージ。
// リスト表示（ContentColumn）とグリッド表示（WorkGrid）で別々に実装され、
// グリッド側は検索語しか考慮していなかった（軸ドリルの絞り込みは無視）。
// 両者から参照する単一実装に統一する。

import type { TagPrefix } from "@mimimilli/shared";
import { getAxisLabel } from "./axisDefinitions";
import type { AxisId } from "./types";

// 検索語・軸ドリルの絞り込みが原因で0件になっているかどうかを踏まえてメッセージを組み立てる。
// どちらも効いていない場合は「そもそもこの軸に作品がない」ケースなので原因表示はしない。
export function buildEmptyWorksMessage(
  searchQuery: string,
  drillAxis: AxisId | null,
  drillValue: string | null,
  tagPrefixes: TagPrefix[] = [],
): string {
  const drillLabel =
    drillAxis && drillValue ? `${getAxisLabel(drillAxis, tagPrefixes)}「${drillValue}」` : null;
  if (searchQuery && drillLabel) {
    return `「${searchQuery}」・${drillLabel} に一致する作品はありません`;
  }
  if (searchQuery) {
    return `「${searchQuery}」に一致する作品はありません`;
  }
  if (drillLabel) {
    return `${drillLabel} に一致する作品はありません`;
  }
  return "作品が見つかりません";
}

/** 絞り込みが原因ではない0件時、軸ごとの文脈を1行添える（fav/missing など）。
 *  該当する軸がなければ undefined（メッセージのみで案内は足さない）。 */
export function buildEmptyWorksHint(
  activeAxis: AxisId,
  isEmptyDueToFilter: boolean,
): string | undefined {
  if (isEmptyDueToFilter) return undefined;
  if (activeAxis === "fav") return "作品詳細の☆ボタンでお気に入りに追加できます";
  if (activeAxis === "missing") return "元ファイルが見つからない作品はここに表示されます";
  return undefined;
}
