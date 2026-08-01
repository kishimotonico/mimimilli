// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import type { CollectionStats, FacetAxisId } from "@mimimilli/shared";
import { ApiRequestError } from "../../../shared/api/http";
import type { WorksQueryParams } from "../api";
import type { AxisId, SortId, ViewMode } from "./types";
import { isFacetAxis, isSmartAxis, isViewAxis } from "./axisDefinitions";

export type PreviewMode = "work" | "axis-landing" | "smart-folder" | "empty";

// ── works query のパラメータ ──────────────────────────────────

export interface WorksParamsInput {
  activeAxis: AxisId;
  sort: SortId;
  searchQuery: string;
  selectedTags: string[];
  drillValue: string | null;
}

/** スマートフォルダー軸は別 query（evalSmartFolder）で取得するため、通常の works query は発行しない */
export function buildWorksParams(input: WorksParamsInput): WorksQueryParams | null {
  const { activeAxis, sort, searchQuery, selectedTags, drillValue } = input;
  if (isSmartAxis(activeAxis)) return null;

  const p: WorksQueryParams = { sort };
  if (searchQuery) p.q = searchQuery;
  if (activeAxis === "tag" && selectedTags.length > 0) {
    p.tags = selectedTags;
    p.tagOp = "AND";
  }
  if (isViewAxis(activeAxis) && activeAxis !== "all") {
    p.view = activeAxis as WorksQueryParams["view"];
  }
  if (isFacetAxis(activeAxis) && drillValue) {
    p.axis = activeAxis as WorksQueryParams["axis"];
    p.axisValue = drillValue;
  }
  return p;
}

/** ファセット一覧（GET /axes/:axis）を取得すべき軸。ドリル済み・タグ以外の軸では null */
export function getFacetAxisForQuery(
  activeAxis: AxisId,
  drillValue: string | null,
): FacetAxisId | null {
  if ((isFacetAxis(activeAxis) && !drillValue) || activeAxis === "tag") {
    return activeAxis as FacetAxisId;
  }
  return null;
}

// ── 中央/プレビュー カラムの表示分岐 ──────────────────────────

export interface WorksListVisibility {
  /** 中央カラムが作品リストを表示する状態（非ファセット軸、またはドリル済み） */
  showsWorksList: boolean;
  canShowWorksGrid: boolean;
  showGrid: boolean;
}

export function computeWorksListVisibility(
  activeAxis: AxisId,
  drillValue: string | null,
  viewMode: ViewMode,
): WorksListVisibility {
  const showsWorksList =
    !isSmartAxis(activeAxis) && (!isFacetAxis(activeAxis) || drillValue !== null);
  const canShowWorksGrid =
    isSmartAxis(activeAxis) ||
    (!isFacetAxis(activeAxis) && activeAxis !== "tag") ||
    (isFacetAxis(activeAxis) && drillValue !== null);
  // ドリル済みファセット軸（例: CV→藤田茜）は、300px固定リスト＋巨大な空プレビュー
  // という体験を避けるため、viewMode（list/grid の永続選好）にかかわらず常に
  // 全幅グリッドへ合流させる。ドリルを抜ければ元の選好に戻る（viewMode 自体は書き換えない）。
  const isDrilledFacet = isFacetAxis(activeAxis) && drillValue !== null;
  const showGrid = canShowWorksGrid && (isDrilledFacet || viewMode === "grid");
  return { showsWorksList, canShowWorksGrid, showGrid };
}

/**
 * 検索語や軸ドリルの絞り込みが原因で作品一覧が0件になっているかどうか。
 * fav/unplayed 等が本来的に0件のケースとは区別し、原因表示が必要な場合だけ案内する。
 *
 * 検索デバウンス後に queryKey が変わった直後は、新クエリが確定するまで
 * works が一時的に空配列になる（isLoading中）。この間を「絞り込みで0件」と
 * 誤判定すると、選択中の作品が実際は結果に含まれる場合でも選択解除が
 * 先走ってしまうため、クエリが loading/error 中は false に倒す
 * （worksCount===0 という結果を信頼できるのは、クエリが成功して確定した後だけ）。
 */
export function computeIsNoResultsDueToFilter(
  showsWorksList: boolean,
  worksCount: number,
  searchQuery: string,
  activeAxis: AxisId,
  drillValue: string | null,
  isWorksLoading: boolean,
  isWorksError: boolean,
): boolean {
  return (
    showsWorksList &&
    !isWorksLoading &&
    !isWorksError &&
    worksCount === 0 &&
    (Boolean(searchQuery) || (isFacetAxis(activeAxis) && drillValue !== null))
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
 * 検索語やドリルの絞り込みで作品一覧が0件になったとき、選択中の作品がその
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

export interface PreviewModeInput {
  isNoResultsDueToFilter: boolean;
  selectedWorkId: string | null;
  activeAxis: AxisId;
  drillValue: string | null;
  selectedTags: string[];
}

// previewMode: UI state + server state を組み合わせてコンポーネントで計算する
// （derived atom にしない — 0件時は選択中の作品が一覧に存在しないため、古い詳細を出さず案内を優先する）
// selectedWorkId があれば読み込み中・エラーの間も "work" モードに留める（詳細データの
// 有無はコンポーネント側でloading/error/読み込み済みを出し分ける。ここで弾くと、
// 読み込み中に一瞬 axis-landing 等へ切り替わってちらつく）。
export function computePreviewMode(input: PreviewModeInput): PreviewMode {
  const { isNoResultsDueToFilter, selectedWorkId, activeAxis, drillValue, selectedTags } = input;
  if (isNoResultsDueToFilter) return "empty";
  if (selectedWorkId) return "work";
  if (isSmartAxis(activeAxis)) return "smart-folder";
  if (isFacetAxis(activeAxis) && !drillValue) return "axis-landing";
  if (activeAxis === "tag" && selectedTags.length > 0) return "axis-landing";
  return "empty";
}
