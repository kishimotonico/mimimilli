// library feature の client/UI state。
// ナビゲーション atom は entities/library/model/navigationAtoms.ts が正。
// ここには URL に載せない表示設定と、値一覧ソートなど library 固有の UI state だけを置く。

import { atom, type createStore } from "jotai";

type Store = ReturnType<typeof createStore>;
import { atomWithStorage } from "jotai/utils";
import type { GridLayoutMode, ViewMode } from "../../../entities/library/types";
import { DEFAULT_GROUP_VALUE_SORT, type GroupValueSortState } from "./groupValueSort";
import type { SmartFolderDialogTarget } from "./smartFolderEditing";

// 値一覧のソート状態。今の並び（route.library.sort）とは別に保持する（ADR-0012 帰結）。
// ソートメニューと list の列見出しクリックは同一のこの state への別入口。
export const groupValueSortAtom = atom<GroupValueSortState>(DEFAULT_GROUP_VALUE_SORT);

// URLには含めない表示設定。ブラウザーを再起動しても直前の見た目を復元する。
export const libraryViewModeAtom = atomWithStorage<ViewMode>("mimimilli:libraryViewMode", "list");
export const libraryTileSizeAtom = atomWithStorage<number>("mimimilli:libraryTileSize", 176);
// グリッドの敷き詰め形式。square=1:1タイル / justified=原寸ジャスティファイド
export const libraryGridLayoutModeAtom = atomWithStorage<GridLayoutMode>(
  "mimimilli:libraryGridLayoutMode",
  "square",
);

// スマートフォルダーのダイアログの対象。サイドバー・チップ列は値を入れるだけで、描画は SmartFolderDialogHost が行う。
export const smartFolderDialogAtom = atom<SmartFolderDialogTarget | null>(null);

/** 保存を始めたダイアログがまだ開いているときだけ閉じる。保存中に閉じて別のダイアログを開いていたら何もしない */
export function closeSmartFolderDialogIfOpen(
  store: Pick<Store, "get" | "set">,
  started: SmartFolderDialogTarget,
): boolean {
  if (store.get(smartFolderDialogAtom) !== started) return false;
  store.set(smartFolderDialogAtom, null);
  return true;
}
