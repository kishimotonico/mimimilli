// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import { parseTag, type CollectionStats, type FacetAxisId } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import type { WorksQueryParams } from "../api";
import type { AxisId, SortId, ViewMode } from "./types";
import { isFacetAxis, isHomeAxis, isSmartAxis, isViewAxis } from "./axisDefinitions";

// ── 組み込み軸の擬似タグ（ADR-0012 §2） ──────────────────────────
// year のようなタグ由来でない組み込み軸も、フィルタとしては selectedTagsAtom に
// "@軸/値" 形式の擬似タグとして載る。先頭の "@" は組み込み軸専用の予約文字で、
// 実タグ（例: 実タグ "year/2025"）との衝突を型と検証で閉じる。
// 組み込み軸専用のクエリパラメータは設けない。

const BUILTIN_AXIS_TAG_PREFIX = "@";

/** タグ由来でない組み込み軸（year のみ。addedAt の年照合）。実タグと衝突するため擬似タグ化する。
 *  異なる2値のANDは常に0件になるため、複数選択も許さない（新しい値が前の選択を置き換える）。 */
export function isBuiltinPseudoTagAxis(axis: string): boolean {
  return axis === "year";
}

/** 組み込み軸の値選択を擬似タグ文字列に組み立てる */
export function buildBuiltinAxisTag(axis: AxisId, value: string): string {
  return `${BUILTIN_AXIS_TAG_PREFIX}${axis}/${value}`;
}

export interface ParsedBuiltinAxisTag {
  axis: string;
  value: string;
}

/** 擬似タグ文字列を軸と値に分解する。擬似タグでなければ null */
export function parseBuiltinAxisTag(tag: string): ParsedBuiltinAxisTag | null {
  if (!tag.startsWith(BUILTIN_AXIS_TAG_PREFIX)) return null;
  const rest = tag.slice(BUILTIN_AXIS_TAG_PREFIX.length);
  const slashIndex = rest.indexOf("/");
  if (slashIndex <= 0 || slashIndex === rest.length - 1) return null;
  return { axis: rest.slice(0, slashIndex), value: rest.slice(slashIndex + 1) };
}

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
    const builtin = parseBuiltinAxisTag(tag);
    if (builtin?.axis === "year") {
      if (yearValue === null) yearValue = builtin.value;
      continue;
    }
    if (builtin) continue; // 未知の組み込み軸擬似タグは実タグとして解釈しない
    tags.push(tag);
  }
  return { tags, yearValue };
}

/** facet/tag 軸の値一覧で1項目を選んだときに selectedTagsAtom へ追加する完全なタグ文字列を組み立てる。
 *  tag 軸は AxisFacetItem.value が既に完全なタグ文字列（ADR-0005 追記）、
 *  year のようなタグ由来でない組み込み軸は擬似タグ、それ以外の facet 軸
 *  （prefix 定義に基づく実タグ由来の軸）は "軸/値" の実タグとして表現する。 */
export function buildFilterTag(axis: AxisId, value: string): string {
  if (axis === "tag") return value;
  if (isBuiltinPseudoTagAxis(axis)) return buildBuiltinAxisTag(axis, value);
  return `${axis}/${value}`;
}

// ── 軸レール・チップの入口共通「置き換え既定」（ADR-0012 §7・TASK-182） ─────

/** タグの「同じ軸/グループ」判定キー。クイックオーバーレイ・チップドロップダウン・
 *  結果面の値タイル/行のクリック（置き換え既定）が、置き換え対象を絞るのに使う。
 *  組み込み軸（擬似タグ）は軸ごと、facet 軸由来の実タグ（prefix付き）は prefix ごと、
 *  フラットタグは1グループにまとめる（tag 軸の値一覧が同じグルーピングで表示するため）。 */
export function tagFilterGroupKey(tag: string): string {
  const builtin = parseBuiltinAxisTag(tag);
  if (builtin) return `@${builtin.axis}`;
  const parsed = parseTag(tag);
  return parsed.kind === "flat" ? "" : parsed.prefix;
}

/** タグ文字列が属する軸ID。チップの兄弟値ドロップダウンで問い合わせる facet 軸を
 *  決めるのに使う。フラットタグは "tag" 軸（値一覧に全フラットタグが並ぶ）を返す。 */
export function axisOfFilterTag(tag: string): AxisId {
  const builtin = parseBuiltinAxisTag(tag);
  if (builtin) return builtin.axis;
  const parsed = parseTag(tag);
  return parsed.kind === "flat" ? "tag" : parsed.prefix;
}

/** 置き換え選択の計算（純粋関数）。同じ tagFilterGroupKey のタグを外してから追加する。
 *  replaceLibraryTagAtom が使う（TASK-182・TASK-186、ADR-0012 §7・§8）。 */
export function computeReplacedTags(prev: string[], tag: string): string[] {
  const group = tagFilterGroupKey(tag);
  return [...prev.filter((t) => tagFilterGroupKey(t) !== group), tag];
}

// ── works query のパラメータ ──────────────────────────────────

export interface WorksParamsInput {
  activeAxis: AxisId;
  sort: SortId;
  searchQuery: string;
  selectedTags: string[];
}

/** selectedTagsAtom から実タグ AND 条件・組み込み軸フィルタを取り出し、works query の
 *  フィールドへ変換する。通常の works query（buildWorksParams）とスマートフォルダー評価
 *  （buildSmartFolderFilterParams）で共通のロジック。 */
export interface TagFilterParams {
  tags?: string[];
  tagOp?: "AND";
  axis?: "year";
  axisValue?: string;
}

function buildTagFilterParams(selectedTags: string[]): TagFilterParams {
  const { tags, yearValue } = splitSelectedTags(selectedTags);
  const params: TagFilterParams = {};
  if (tags.length > 0) {
    params.tags = tags;
    params.tagOp = "AND";
  }
  if (yearValue !== null) {
    params.axis = "year";
    params.axisValue = yearValue;
  }
  return params;
}

/** works 種の結果面（ビュー軸・スマートフォルダー軸）以外は works query を発行しない。
 *  スマートフォルダーは別 query（evalSmartFolder）で取得する。 */
export function buildWorksParams(input: WorksParamsInput): WorksQueryParams | null {
  const { activeAxis, sort, searchQuery, selectedTags } = input;
  if (computeResultsPaneKind(activeAxis) !== "works" || isSmartAxis(activeAxis)) return null;

  const p: WorksQueryParams = { sort, ...buildTagFilterParams(selectedTags) };
  if (searchQuery) p.q = searchQuery;
  if (isViewAxis(activeAxis) && activeAxis !== "all") {
    p.view = activeAxis as WorksQueryParams["view"];
  }
  return p;
}

/** スマートフォルダー評価API（GET /smart-folders/:id/works）へ渡す追加フィルタ。
 *  フォルダーのルールに対する追加の AND 条件として適用される（ADR-0012、TASK-185）。
 *  フィルタが無ければキーを持たない空オブジェクトを返す（クエリキーの安定のため）。 */
export function buildSmartFolderFilterParams(selectedTags: string[]): TagFilterParams {
  return buildTagFilterParams(selectedTags);
}

/** ファセット一覧（GET /axes/:axis）を取得すべき軸。value-list 種の結果面のみ */
export function getFacetAxisForQuery(activeAxis: AxisId): FacetAxisId | null {
  return computeResultsPaneKind(activeAxis) === "value-list" ? (activeAxis as FacetAxisId) : null;
}

/**
 * 軸ファセット取得API（GET /axes/:axis）へ渡す絞り込み。自軸除外カウント（TASK-187）:
 * 軸Xの値一覧の件数・総時間・代表カバーは、現在のフィルタから軸X由来のフィルタ
 * （axisOfFilterTag(tag) === axis のもの）を除いた集合に対して集計する。同軸を乗り換える
 * ときの表示件数が、置き換え後（TASK-182: 通常クリックは置き換え既定）の実結果と一致し、
 * 他軸フィルタによる0件だらけの空振りも防げる。「選択中の値は特別に残す」という例外は
 * 自軸除外なら不要（選択中の値自身も他軸フィルタだけを適用した普通の件数で残る）。
 */
export function buildAxisFacetFilterParams(axis: AxisId, selectedTags: string[]): TagFilterParams {
  const otherAxisTags = selectedTags.filter((tag) => axisOfFilterTag(tag) !== axis);
  return buildTagFilterParams(otherAxisTags);
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
