// library feature の client/UI state。
// ナビゲーション atom は entities/library/model/navigationAtoms.ts が正。
// ここには URL に載せない表示設定と、値一覧ソートなど library 固有の UI state だけを置く。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { TagPrefix } from "@mimimilli/shared";
import type { AxisId, GridLayoutMode, ViewMode } from "../../../entities/library/types";
import { getAxisLabel } from "../../../entities/library/axisDefinitions";
import { DEFAULT_AXIS_VALUE_SORT, type AxisValueSortState } from "./axisValueSort";

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

// 作品登録解除の成功通知。成功時にWorkDetailが遷移・アンマウントされるため、
// ローカルstateではなくGlobalToastが拾えるグローバルatomに置く。
export const workDeleteSuccessAtom = atom<string | null>(null);

// ── アドレスバーパス（純粋計算）────────────────────────────────

// パンくずは「ライブラリ > 軸名」までを表す。絞り込みはチップ列だけが表現する
// （ADR-0012 §2・帰結）。
export function buildLibraryAddressPath(axis: AxisId, tagPrefixes: TagPrefix[]): string[] {
  if (axis === "all") return ["ライブラリ"];
  return ["ライブラリ", getAxisLabel(axis, tagPrefixes)];
}
