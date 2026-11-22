// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import {
  groupChipTag,
  isBuiltinPseudoTagKey,
  normalizeGroupValue,
  parseBuiltinPseudoTag,
  TagNormalizationError,
  type GroupValueItem,
  type CollectionStats,
  type GroupBy,
  type NormalizedTag,
} from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import { getGroupByLabel } from "../../../entities/library/smartFolderDefinitions";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";

// 組み込みの擬似タグ（year 等、ADR-0012 §2）の構築・解析・検証は shared/pseudoTag.ts に
// 集約している（client・server の両方が同じ実装を使うため）。isBuiltinPseudoTagKey /
// buildBuiltinPseudoTag / parseBuiltinPseudoTag / splitSelectedTags は @mimimilli/shared から
// 直接importする。

/** グループ分けの値一覧で1項目を選んだときにチップへ足す完全なタグ文字列を組み立てる。
 *  tag は GroupValueItem.value が既に完全なタグ文字列（ADR-0005）、
 *  addedYear は擬似タグ（@year/値）、prefix は "prefix/値" の実タグとして表現する。 */
export function buildFilterTag(groupBy: GroupBy, value: string): NormalizedTag {
  const normalized = normalizeGroupValue(groupBy, value);
  if (normalized === null) throw new TagNormalizationError(value);
  return groupChipTag(groupBy, normalized);
}

/** サーバーの値一覧が、グループの値として使えるものだけかを確かめる。使えない値はサーバーとの契約違反なので、
 *  読み飛ばさず一覧の取得エラーにする（描画中の throw にしない） */
export function assertGroupValueItems<T extends GroupValueItem>(groupBy: GroupBy, items: T[]): T[] {
  for (const item of items) {
    if (normalizeGroupValue(groupBy, item.value) === null) {
      throw new Error(
        `グループ分け「${groupByKey(groupBy)}」の値「${item.value}」はグループの値として使えません`,
      );
    }
  }
  return items;
}

/** チップ表示用の文字列。design-system.md の「チップはフルパス表示」規約は維持しつつ、
 *  組み込みの擬似タグ（@year/2023等）だけ内部表現ではなく「グループ分けのラベル/値」（例:
 *  「追加年/2023」）に変換する。実タグはそのまま tag を返す。 */
export function formatFilterChipLabel(tag: NormalizedTag): string {
  const builtin = parseBuiltinPseudoTag(tag);
  if (!builtin || !isBuiltinPseudoTagKey(builtin.key)) return tag;
  return `${getGroupByLabel({ kind: "addedYear" })}/${builtin.value}`;
}

// ── 未選択プレースホルダーの統計表示 ────────────────────────────

/** 未選択プレースホルダー（CollectionPlaceholder）に渡す統計の表示状態。
 *  loading 中は行自体を出さず、error は隠さず案内する（雑にフォールバックしない）。 */
export type CollectionStatsDisplay =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; count: number; trackCount: number; durationSec: number };

/**
 * 検索語やタグフィルタの絞り込みで作品一覧が0件になったとき、選択中の作品がその
 * 絞り込み結果に含まれない古い選択のまま残っていないかを判定する。
 * true の場合は選択を解除すべき。
 */
export function shouldClearSelectionOnFilterMiss(
  isNoResultsDueToFilter: boolean,
  selectedWorkId: string | null,
): boolean {
  return isNoResultsDueToFilter && selectedWorkId !== null;
}

/**
 * 選択中の作品詳細（GET /works/:id）取得エラーのうち、404（作品が既に存在しない。
 * 削除済み作品などをwork=パラメータで開いた場合）だけを「選択解除・URLクリーンアップ
 * すべきエラー」として判定する。ネットワーク断や5xx等の一時的な失敗まで選択解除すると、
 * 再試行すれば見られるはずの作品が勝手に選択解除されてしまうため、それ以外のエラーは
 * 選択を維持し、パネル側でエラー表示・再試行を出す。
 */
export function shouldClearSelectionOnWorkNotFound(
  selectedWorkId: string | null,
  error: unknown,
): boolean {
  return selectedWorkId !== null && error instanceof ApiRequestError && error.status === 404;
}

export function computeCollectionStatsDisplay(
  isLoading: boolean,
  isError: boolean,
  worksTotal: number | undefined,
  worksStats: CollectionStats | undefined,
): CollectionStatsDisplay {
  if (isError) return { status: "error" };
  if (isLoading || worksTotal === undefined || worksStats === undefined) {
    return { status: "loading" };
  }
  return {
    status: "ready",
    count: worksTotal,
    trackCount: worksStats.trackCount,
    durationSec: worksStats.durationSec,
  };
}
