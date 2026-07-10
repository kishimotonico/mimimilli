// LibraryView の表示導出ロジック（純粋計算）。
// query 結果と Jotai state を組み合わせて「何を表示するか」を決める部分を、
// コンポーネントの配線から切り離してテスト可能にする。

import type { FacetAxisId } from "@mimimilli/shared";
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
  const showGrid = viewMode === "grid" && canShowWorksGrid;
  return { showsWorksList, canShowWorksGrid, showGrid };
}

/**
 * 検索語や軸ドリルの絞り込みが原因で作品一覧が0件になっているかどうか。
 * fav/unplayed 等が本来的に0件のケースとは区別し、原因表示が必要な場合だけ案内する。
 */
export function computeIsNoResultsDueToFilter(
  showsWorksList: boolean,
  worksCount: number,
  searchQuery: string,
  activeAxis: AxisId,
  drillValue: string | null,
): boolean {
  return (
    showsWorksList &&
    worksCount === 0 &&
    (Boolean(searchQuery) || (isFacetAxis(activeAxis) && drillValue !== null))
  );
}

export interface PreviewModeInput {
  isNoResultsDueToFilter: boolean;
  selectedWorkId: string | null;
  hasSelectedWork: boolean;
  activeAxis: AxisId;
  drillValue: string | null;
  selectedTags: string[];
}

// previewMode: UI state + server state を組み合わせてコンポーネントで計算する
// （derived atom にしない — 0件時は選択中の作品が一覧に存在しないため、古い詳細を出さず案内を優先する）
export function computePreviewMode(input: PreviewModeInput): PreviewMode {
  const {
    isNoResultsDueToFilter,
    selectedWorkId,
    hasSelectedWork,
    activeAxis,
    drillValue,
    selectedTags,
  } = input;
  if (isNoResultsDueToFilter) return "empty";
  if (selectedWorkId && hasSelectedWork) return "work";
  if (isSmartAxis(activeAxis)) return "smart-folder";
  if (isFacetAxis(activeAxis) && !drillValue) return "axis-landing";
  if (activeAxis === "tag" && selectedTags.length > 0) return "axis-landing";
  return "empty";
}
