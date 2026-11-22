// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import {
  buildBuiltinAxisTag,
  isBuiltinPseudoTagAxis,
  normalizeTag,
  parseBuiltinAxisTag,
  TagNormalizationError,
  type AxisFacetItem,
  type CollectionStats,
  type GroupBy,
  type NormalizedTag,
} from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import type { AxisId } from "../../../entities/library/types";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";

// 組み込み軸の擬似タグ（year 等、ADR-0012 §2）の構築・解析・検証は shared/pseudoTag.ts に
// 集約している（client・server の両方が同じ実装を使うため）。isBuiltinPseudoTagAxis /
// buildBuiltinAxisTag / parseBuiltinAxisTag / splitSelectedTags は @mimimilli/shared から
// 直接importする。

/** facet/tag 軸の値一覧で1項目を選んだときにチップへ足す完全なタグ文字列を組み立てる。
 *  tag 軸は AxisFacetItem.value が既に完全なタグ文字列（ADR-0005）、
 *  year のようなタグ由来でない組み込み軸は擬似タグ、それ以外の facet 軸
 *  （prefix 定義に基づく実タグ由来の軸）は "軸/値" の実タグとして表現する。 */
export function buildFilterTag(axis: AxisId, value: string): NormalizedTag {
  if (axis === "tag") {
    const normalized = normalizeTag(value);
    if (normalized === null) throw new TagNormalizationError(value);
    return normalized;
  }
  if (isBuiltinPseudoTagAxis(axis)) return buildBuiltinAxisTag(axis, value);
  const normalized = normalizeTag(`${axis}/${value}`);
  if (normalized === null) throw new TagNormalizationError(`${axis}/${value}`);
  return normalized;
}

/** サーバー由来の facet 一覧から、buildFilterTag が正規化できない値を取り除く。
 *  軸の値一覧はこれを通ったデータだけを描画対象にすることで、不正値による
 *  render中throw（RootErrorBoundaryへの巻き込み）を経路として残さない。 */
export function filterValidFacetItems<T extends AxisFacetItem>(axis: AxisId, items: T[]): T[] {
  return items.filter((item) => {
    try {
      buildFilterTag(axis, item.value);
      return true;
    } catch (cause) {
      if (!(cause instanceof TagNormalizationError)) throw cause;
      console.warn(`軸「${axis}」の値「${item.value}」を正規化できないためスキップしました`, cause);
      return false;
    }
  });
}

/** グループ分けの種類に対応する軸 ID（prefix 軸・タグ・追加年）。軸 ID は値一覧の部品が
 *  ラベル・アイコン・値→タグの変換に使う */
export function axisOfGroupBy(groupBy: GroupBy): AxisId {
  switch (groupBy.kind) {
    case "prefix":
      return groupBy.prefix;
    case "tag":
      return "tag";
    case "addedYear":
      return "year";
  }
}

/** 「＋絞り込み」の軸選択で選ばれた軸のグループ分け */
export function groupByOfAxis(axis: AxisId): GroupBy {
  if (axis === "tag") return { kind: "tag" };
  if (axis === "year") return { kind: "addedYear" };
  return { kind: "prefix", prefix: axis };
}

/** チップ表示用の文字列。design-system.md の「チップはフルパス表示」規約は維持しつつ、
 *  組み込み軸の擬似タグ（@year/2023等）だけ内部表現ではなく「軸ラベル/値」（例:
 *  「追加日/2023」）に変換する。実タグはそのまま tag を返す。 */
export function formatFilterChipLabel(tag: NormalizedTag): string {
  const builtin = parseBuiltinAxisTag(tag);
  if (!builtin) return tag;
  return `${getAxisLabel(builtin.axis)}/${builtin.value}`;
}

/** 作品一覧の描画結果（グリッド・リスト・エラー境界）を再マウントすべきタイミングを表す
 *  安定なキー */
export interface WorksResetKeyInput {
  folderId: string;
  group: string | null;
  selectedTags: NormalizedTag[];
  sort: string;
  searchQuery: string;
  seed: number | undefined;
}

export function buildWorksResetKey(input: WorksResetKeyInput): string {
  return JSON.stringify(input);
}

/**
 * 検索語やタグフィルタが原因で作品一覧が0件になっているかどうか。
 * fav 等が本来的に0件のケースとは区別し、原因表示が必要な場合だけ案内する。
 *
 * 検索デバウンス後に queryKey が変わった直後は、新クエリが確定するまで
 * works が一時的に空配列になる（isLoading中）。この間を「絞り込みで0件」と
 * 誤判定すると、選択中の作品が実際は結果に含まれる場合でも選択解除が
 * 先走ってしまうため、クエリが loading/error 中は false に倒す
 * （worksCount===0 という結果を信頼できるのは、クエリが成功して確定した後だけ）。
 */
export function computeIsNoResultsDueToFilter(
  isWorksPane: boolean,
  worksCount: number,
  searchQuery: string,
  selectedTags: NormalizedTag[],
  isWorksLoading: boolean,
  isWorksError: boolean,
): boolean {
  return (
    isWorksPane &&
    !isWorksLoading &&
    !isWorksError &&
    worksCount === 0 &&
    (Boolean(searchQuery) || selectedTags.length > 0)
  );
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
