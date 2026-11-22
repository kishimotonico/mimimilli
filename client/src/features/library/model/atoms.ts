// library feature の client/UI state。
// ナビゲーション atom は entities/library/model/navigationAtoms.ts が正。
// ここには URL に載せない表示設定など library 固有の UI state だけを置く。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { GridLayoutMode, ViewMode } from "../../../entities/library/types";
import type { SmartFolderDialogTarget } from "./smartFolderEditing";

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
