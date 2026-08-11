// 作品リストが0件のときの案内メッセージ。
// リスト表示・グリッド表示の両方から参照する単一実装に統一する。

import type { AxisId } from "../../../entities/library/types";

// 検索語・選択中フィルタ（selectedTagsAtom）が原因で0件になっているかどうかを踏まえて
// メッセージを組み立てる。どちらも効いていない場合は「そもそもこの軸に作品がない」
// ケースなので原因表示はしない。
export function buildEmptyWorksMessage(searchQuery: string, hasSelectedTags: boolean): string {
  if (searchQuery && hasSelectedTags) {
    return `「${searchQuery}」・選択中のフィルタ に一致する作品はありません`;
  }
  if (searchQuery) {
    return `「${searchQuery}」に一致する作品はありません`;
  }
  if (hasSelectedTags) {
    return "選択中のフィルタに一致する作品はありません";
  }
  return "作品が見つかりません";
}

/** 絞り込みが原因ではない0件時、軸ごとの文脈を1行添える（fav/error など）。
 *  該当する軸がなければ undefined（メッセージのみで案内は足さない）。 */
export function buildEmptyWorksHint(
  activeAxis: AxisId,
  isEmptyDueToFilter: boolean,
): string | undefined {
  if (isEmptyDueToFilter) return undefined;
  if (activeAxis === "fav") return "作品詳細の☆ボタンでお気に入りに追加できます";
  if (activeAxis === "error")
    return "元ファイルが見つからない・メタデータの読み込みに失敗した作品はここに表示されます";
  return undefined;
}
