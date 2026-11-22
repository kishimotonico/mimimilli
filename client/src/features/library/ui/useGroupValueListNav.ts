import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { useVirtualList, type UseVirtualListOptions } from "../../../shared/ui/useVirtualList";
import { focusVirtualItem } from "../../../shared/lib/focusVirtualItem";
import {
  getNextGroupValueRowIndex,
  nearestValueRowIndex,
  type GroupValueRowArrowKey,
} from "../model/groupValueRowNav";
import type { GroupValueHierarchyRow } from "../model/groupValueHierarchy";
import { useRovingIndex } from "./useRovingIndex";

interface UseGroupValueListNavOptions {
  rows: readonly GroupValueHierarchyRow[];
  virtualList: Omit<UseVirtualListOptions, "count" | "resetScrollTop">;
  /** 行インデックスから、その行のフォーカス対象要素を指すセレクタを返す */
  itemSelector: (rowIndex: number) => string;
}

// 値一覧（GroupValueRows・GroupValueQuickList）が共有する、仮想リスト・roving tabindex・
// 矢印キー移動。現在位置は ref を正とし、フォーカス確定前に次のキー入力が来ても
// 取りこぼさない。位置は virtualList.resetKey が変わるまで維持する。
export function useGroupValueListNav({
  rows,
  virtualList,
  itemSelector,
}: UseGroupValueListNavOptions) {
  const list = useVirtualList({ ...virtualList, count: rows.length, resetScrollTop: true });
  const { scrollRef, virtualizer, virtualItems } = list;

  const activeIndexRef = useRef(-1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const updateActiveIndex = useCallback((index: number) => {
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);
  useEffect(() => {
    updateActiveIndex(-1);
  }, [virtualList.resetKey, updateActiveIndex]);

  const rawRovingIndex = useRovingIndex({
    itemCount: rows.length,
    targetIndex: activeIndex >= 0 ? activeIndex : null,
    virtualItems,
    toRowIndex: (index) => index,
    firstFlatIndexOfRow: (index) => index,
  });
  const rovingIndex = nearestValueRowIndex(rows, rawRovingIndex);

  const moveFocus = (key: GroupValueRowArrowKey) => {
    const listEl = scrollRef.current;
    if (!listEl) return;
    const nextIndex = getNextGroupValueRowIndex(rows, activeIndexRef.current, key);
    if (nextIndex === -1 || nextIndex === activeIndexRef.current) return;
    updateActiveIndex(nextIndex);
    focusVirtualItem(listEl, virtualizer, nextIndex, itemSelector(nextIndex));
  };

  /** マウスクリック・Tab等でフォーカスが動いたときも現在位置を追従させる */
  const handleListFocus = (event: FocusEvent<HTMLElement>) => {
    const indexAttr = (event.target as HTMLElement)
      .closest("[data-index]")
      ?.getAttribute("data-index");
    if (indexAttr !== null && indexAttr !== undefined) updateActiveIndex(Number(indexAttr));
  };

  return { ...list, rovingIndex, moveFocus, handleListFocus };
}
