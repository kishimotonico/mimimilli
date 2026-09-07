import { useCallback, type RefObject } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import type { Virtualizer } from "@tanstack/react-virtual";
import { getNextGridIndex, type GridArrowKey } from "../model/gridNavigation";
import { focusVirtualItem } from "../../../shared/lib/focusVirtualItem";

interface UseWorkListKeyboardNavOptions {
  listRef: RefObject<HTMLDivElement | null>;
  works: WorkListItem[];
  onWorkSelect: (id: string) => void;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
}

// リスト表示は1列（columnCount=1）のグリッドとして矢印キー移動を扱う。
// ↑↓とHome/Endはグリッドと同じ getNextGridIndex を流用し（columnCount=1なので
// ArrowUp/Downが±1になる）、←→は列移動が無いリストでは扱わない（WorkRow側で
// GridArrowKeyに含めていない）。
export function useWorkListKeyboardNav({
  listRef,
  works,
  onWorkSelect,
  virtualizer,
}: UseWorkListKeyboardNavOptions) {
  return useCallback(
    (currentIndex: number, key: GridArrowKey) => {
      const listEl = listRef.current;
      if (!listEl) return;

      const nextIndex = getNextGridIndex(currentIndex, key, 1, works.length);
      if (nextIndex === currentIndex) return;

      const nextWork = works[nextIndex];
      if (nextWork) onWorkSelect(nextWork.id);

      focusVirtualItem(listEl, virtualizer, nextIndex, `[data-flat-index="${nextIndex}"]`);
    },
    [listRef, works, onWorkSelect, virtualizer],
  );
}
