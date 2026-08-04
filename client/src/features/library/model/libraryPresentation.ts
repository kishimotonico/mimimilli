// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import type { CollectionStats, FacetAxisId } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import type { WorksQueryParams } from "../api";
import type { AxisId, SortId, ViewMode } from "./types";
import { isFacetAxis, isHomeAxis, isSmartAxis, isViewAxis } from "./axisDefinitions";

/** year 軸は URL 上 "year/2024" 形式の擬似タグとして selectedTagsAtom に載る
 *  （ADR-0012 §2）。組み込み軸専用のクエリパラメータは設けない。 */
const YEAR_TAG_PREFIX = "year/";

// ── 結果面の種類（ADR-0012: ナビゲーション状態・表示設定・絞り込み状態の分離） ──

export type ResultsPaneKind = "home" | "value-list" | "works";

/**
 * 軸だけから決まる結果面の種類。絞り込み状態（selectedTags）や表示設定（viewMode）には
 * 依存しない — 軸は値をブラウズするためのビューであり、選択状態を持たない（ADR-0012 §1）。
 *   - home: 発見ダッシュボード
 *   - value-list: facet 軸・タグ軸の値一覧（本タスクでは素朴な一覧、TASK-181 で本実装）
 *   - works: 作品一覧（ビュー軸・スマートフォルダー軸）
 */
export function computeResultsPaneKind(axis: AxisId): ResultsPaneKind {
  if (isHomeAxis(axis)) return "home";
  if (isFacetAxis(axis) || axis === "tag") return "value-list";
  return "works";
}

/** グリッド／リストの決定は libraryViewModeAtom のみに依存する（ADR-0012 §3）。
 *  works 以外の結果面（value-list・home）はグリッド概念を持たない。 */
export function isWorksGridActive(axis: AxisId, viewMode: ViewMode): boolean {
  return computeResultsPaneKind(axis) === "works" && viewMode === "grid";
}

// ── 選択中フィルタ（selectedTagsAtom）の解釈 ────────────────────

export interface SplitSelectedTags {
  /** 実タグとして work.tags と完全一致させるもの */
  tags: string[];
  /** year 軸から選ばれた addedAt の年（複数選択は仕様上 AND が常に0件になるため先頭のみ採用） */
  yearValue: string | null;
}

export function splitSelectedTags(selectedTags: string[]): SplitSelectedTags {
  let yearValue: string | null = null;
  const tags: string[] = [];
  for (const tag of selectedTags) {
    if (tag.startsWith(YEAR_TAG_PREFIX)) {
      if (yearValue === null) yearValue = tag.slice(YEAR_TAG_PREFIX.length);
      continue;
    }
    tags.push(tag);
  }
  return { tags, yearValue };
}

/** facet/tag 軸の値一覧で1項目を選んだときに selectedTagsAtom へ追加する完全なタグ文字列を組み立てる。
 *  tag 軸は AxisFacetItem.value が既に完全なタグ文字列（ADR-0005 追記）、
 *  それ以外の facet 軸（year 含む）は "軸/値" の擬似タグとして表現する。 */
export function buildFilterTag(axis: AxisId, value: string): string {
  return axis === "tag" ? value : `${axis}/${value}`;
}

// ── works query のパラメータ ──────────────────────────────────

export interface WorksParamsInput {
  activeAxis: AxisId;
  sort: SortId;
  searchQuery: string;
  selectedTags: string[];
}

/** works 種の結果面（ビュー軸・スマートフォルダー軸）以外は works query を発行しない。
 *  スマートフォルダーは別 query（evalSmartFolder）で取得する。 */
export function buildWorksParams(input: WorksParamsInput): WorksQueryParams | null {
  const { activeAxis, sort, searchQuery, selectedTags } = input;
  if (computeResultsPaneKind(activeAxis) !== "works" || isSmartAxis(activeAxis)) return null;

  const p: WorksQueryParams = { sort };
  if (searchQuery) p.q = searchQuery;
  if (isViewAxis(activeAxis) && activeAxis !== "all") {
    p.view = activeAxis as WorksQueryParams["view"];
  }

  const { tags, yearValue } = splitSelectedTags(selectedTags);
  if (tags.length > 0) {
    p.tags = tags;
    p.tagOp = "AND";
  }
  if (yearValue !== null) {
    p.axis = "year";
    p.axisValue = yearValue;
  }
  return p;
}

/** ファセット一覧（GET /axes/:axis）を取得すべき軸。value-list 種の結果面のみ */
export function getFacetAxisForQuery(activeAxis: AxisId): FacetAxisId | null {
  return computeResultsPaneKind(activeAxis) === "value-list" ? (activeAxis as FacetAxisId) : null;
}

/**
 * 検索語やタグフィルタが原因で作品一覧が0件になっているかどうか。
 * fav/unplayed 等が本来的に0件のケースとは区別し、原因表示が必要な場合だけ案内する。
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
  selectedTags: string[],
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
