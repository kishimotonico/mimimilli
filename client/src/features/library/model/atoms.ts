// library feature の client/UI state。
// active axis・drill・tag filter・選択作品など、API 由来でない操作状態を Jotai atom で管理する。
// previewMode のような「UI state と server state 両方に依存する派生」はここに置かず、
// コンポーネント側で useQuery 結果と atom 値を組み合わせて計算する（issue 参照）。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import type { AxisId, GridLayoutMode, SortId, ViewMode } from "../../../entities/library/types";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";
import { DEFAULT_AXIS_VALUE_SORT, type AxisValueSortState } from "./axisValueSort";

// ライブラリ検索語。URLの q= パラメータへ同期する（useNavigationHistory）。localStorage には保存しない。
export const librarySearchQueryAtom = atom("");

// ── ナビゲーション state ──────────────────────────────────────

export const activeAxisAtom = atom<AxisId>("all");
// 軸の値選択（facet/tag 問わず）はすべてここへ入る（ADR-0012 §2）。
// year 軸のような組み込み軸は "year/2024" 形式の擬似タグとして同じ配列に載る。
export const selectedTagsAtom = atom<NormalizedTag[]>([]);
export const selectedWorkIdAtom = atom<string | null>(null);
export const sortAtom = atom<SortId>("added-desc");
// 値一覧のソート状態。sortAtom（作品一覧）とは別に保持する（ADR-0012 帰結）。
// ソートメニューと list の列見出しクリックは同一のこの state への別入口。
export const axisValueSortAtom = atom<AxisValueSortState>(DEFAULT_AXIS_VALUE_SORT);

// URLには含めない表示設定。ブラウザーを再起動しても直前の見た目を復元する。
export const libraryViewModeAtom = atomWithStorage<ViewMode>("mimimilli:libraryViewMode", "list");
export const libraryTileSizeAtom = atomWithStorage<number>("mimimilli:libraryTileSize", 176);
// グリッドの敷き詰め形式（TASK-45）。square=1:1タイル / justified=原寸ジャスティファイド
export const libraryGridLayoutModeAtom = atomWithStorage<GridLayoutMode>(
  "mimimilli:libraryGridLayoutMode",
  "square",
);

// ── アドレスバーパス（純粋計算）────────────────────────────────

// パンくずは「ライブラリ > 軸名」までを表す。絞り込みはチップ列だけが表現する
// （ADR-0012 §2・帰結）。
export function buildLibraryAddressPath(axis: AxisId, tagPrefixes: TagPrefix[]): string[] {
  if (axis === "all") return ["ライブラリ"];
  return ["ライブラリ", getAxisLabel(axis, tagPrefixes)];
}
