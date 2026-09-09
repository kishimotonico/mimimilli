import { useCallback } from "react";
import type { Virtualizer } from "@tanstack/react-virtual";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  rowIndexOfFlatIndex,
  type GridArrowKey,
} from "../../../shared/lib/gridNavigation";
import { focusVirtualItem } from "../../../shared/lib/focusVirtualItem";
import type { JustifiedLayout } from "../model/justifiedLayout";

interface UseGridKeyboardNavOptions<T> {
  gridEl: HTMLDivElement | null;
  /** ジャスティファイドグリッド（作品グリッドのみ）。対象外のグリッドは isJustified: false */
  isJustified: boolean;
  justifiedLayout: JustifiedLayout | null;
  columnCount: number;
  items: T[];
  /** フォーカス移動先が決まったときの通知。roving tabindexの現在位置の更新に使う
   *  （作品グリッドでは選択の更新も兼ねる） */
  onFocusItem: (item: T, index: number) => void;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

// 作品グリッド・値グリッドが共有するグリッドの矢印キーナビ。
export function useGridKeyboardNav<T>({
  gridEl,
  isJustified,
  justifiedLayout,
  columnCount,
  items,
  onFocusItem,
  virtualizer,
}: UseGridKeyboardNavOptions<T>) {
  return useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      if (!gridEl) return;

      const nextIndex =
        isJustified && justifiedLayout
          ? getNextJustifiedIndex(justifiedLayout.tiles, currentIndex, key)
          : getNextGridIndex(currentIndex, key, columnCount, items.length);
      if (nextIndex === currentIndex) return;

      const rowIndex = rowIndexOfFlatIndex(
        nextIndex,
        isJustified,
        justifiedLayout?.tiles ?? null,
        columnCount,
      );
      if (rowIndex === undefined) return;

      const nextItem = items[nextIndex];
      if (nextItem) onFocusItem(nextItem, nextIndex);

      focusVirtualItem(gridEl, virtualizer, rowIndex, `[data-flat-index="${nextIndex}"]`);
    },
    [gridEl, isJustified, justifiedLayout, columnCount, items, onFocusItem, virtualizer],
  );
}
