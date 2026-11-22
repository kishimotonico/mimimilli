// 作品リストが0件のときの案内メッセージ。
// リスト表示・グリッド表示の両方から参照する単一実装に統一する。

import { isBookmarkedOnly, isHasErrorOnly, type Condition } from "@mimimilli/shared";

// 検索語・選択中のチップが原因で0件になっているかどうかを踏まえて
// メッセージを組み立てる。どちらも効いていない場合は「そもそもこのスマートフォルダーに作品がない」
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

/** 絞り込みが原因ではない0件時、条件の形ごとの文脈を1行添える（お気に入り・エラー）。
 *  該当しなければ undefined（メッセージのみで案内は足さない）。 */
export function buildEmptyWorksHint(
  condition: Condition | null,
  isEmptyDueToFilter: boolean,
): string | undefined {
  if (isEmptyDueToFilter || condition === null) return undefined;
  if (isBookmarkedOnly(condition)) return "作品をブックマークするとお気に入りに表示されます";
  if (isHasErrorOnly(condition))
    return "元ファイルが見つからない・メタデータの読み込みに失敗した作品はここに表示されます";
  return undefined;
}
