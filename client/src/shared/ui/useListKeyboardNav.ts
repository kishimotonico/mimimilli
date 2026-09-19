import { useCallback } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  rowIndexOfFlatIndex,
  type GridArrowKey,
  type JustifiedTilePosition,
} from "../lib/gridNavigation";
import { focusVirtualItem } from "../lib/focusVirtualItem";

interface UseListKeyboardNavOptions<T> {
  containerEl: HTMLDivElement | null;
  items: readonly T[];
  columnCount: number;
  /** ジャスティファイドグリッドのタイル位置。無ければ columnCount 固定のグリッド
   *  （1列ならリスト）として扱う */
  justifiedTiles?: readonly JustifiedTilePosition[] | null;
  /** 省略時は非仮想化の一覧として、対象行を直接focusする */
  virtualizer?: Pick<Virtualizer<HTMLDivElement, Element>, "scrollToIndex"> | null;
  /** フォーカス移動先が決まったときの通知。roving tabindexの現在位置の更新に使う
   *  （選択の更新を兼ねる場合もある） */
  onFocusItem: (item: T, index: number) => void;
}

// 作品グリッド・値グリッド・作品リスト・ファイル一覧が共有する矢印キーナビ。
export function useListKeyboardNav<T>({
  containerEl,
  items,
  columnCount,
  justifiedTiles = null,
  virtualizer = null,
  onFocusItem,
}: UseListKeyboardNavOptions<T>) {
  return useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      if (!containerEl) return;

      const nextIndex = justifiedTiles
        ? getNextJustifiedIndex(justifiedTiles, currentIndex, key)
        : getNextGridIndex(currentIndex, key, columnCount, items.length);
      if (nextIndex === currentIndex) return;

      const rowIndex = rowIndexOfFlatIndex(
        nextIndex,
        Boolean(justifiedTiles),
        justifiedTiles,
        columnCount,
      );
      if (rowIndex === undefined) return;

      const nextItem = items[nextIndex];
      if (nextItem) onFocusItem(nextItem, nextIndex);

      focusVirtualItem(containerEl, virtualizer, rowIndex, `[data-flat-index="${nextIndex}"]`);
    },
    [containerEl, items, columnCount, justifiedTiles, virtualizer, onFocusItem],
  );
}
