import { useCallback } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import type { Virtualizer } from "@tanstack/react-virtual";
import {
  getNextGridIndex,
  getNextJustifiedIndex,
  rowIndexOfFlatIndex,
  type GridArrowKey,
} from "../../model/gridNavigation";
import type { JustifiedLayout } from "../../model/justifiedLayout";
import { focusVirtualItem } from "../../../../shared/lib/focusVirtualItem";

interface UseWorkGridKeyboardNavOptions {
  gridEl: HTMLDivElement | null;
  isJustified: boolean;
  justifiedLayout: JustifiedLayout | null;
  columnCount: number;
  works: WorkListItem[];
  onWorkSelect: (id: string) => void;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

export function useWorkGridKeyboardNav({
  gridEl,
  isJustified,
  justifiedLayout,
  columnCount,
  works,
  onWorkSelect,
  virtualizer,
}: UseWorkGridKeyboardNavOptions) {
  return useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      if (!gridEl) return;

      const nextIndex =
        isJustified && justifiedLayout
          ? getNextJustifiedIndex(justifiedLayout.tiles, currentIndex, key)
          : getNextGridIndex(currentIndex, key, columnCount, works.length);
      if (nextIndex === currentIndex) return;

      const rowIndex = rowIndexOfFlatIndex(
        nextIndex,
        isJustified,
        justifiedLayout?.tiles ?? null,
        columnCount,
      );

      const nextWork = works[nextIndex];
      if (nextWork) onWorkSelect(nextWork.id);

      focusVirtualItem(gridEl, virtualizer, rowIndex, `[data-flat-index="${nextIndex}"]`);
    },
    [gridEl, isJustified, justifiedLayout, columnCount, works, onWorkSelect, virtualizer],
  );
}
