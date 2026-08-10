import { useCallback, useEffect, useRef, type CSSProperties, type RefObject } from "react";
import { useVirtualizer, type VirtualItem, type Virtualizer } from "@tanstack/react-virtual";
import { shouldLoadMore } from "../lib/virtualScroll";

export interface VirtualListPadding {
  start?: number;
  end?: number;
}

export interface VirtualListInfiniteScroll {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export interface UseVirtualListOptions {
  count: number;
  estimateSize: number | (() => number);
  resetKey?: string;
  gap?: number;
  padding?: VirtualListPadding;
  overscan?: number;
  measureElement?: (element: Element) => number;
  scrollRef?: RefObject<HTMLDivElement | null>;
  /** resetKey 変化時に scrollTop も 0 に戻す（軸値リスト系） */
  resetScrollTop?: boolean;
  infiniteScroll?: VirtualListInfiniteScroll;
}

export interface VirtualListItemStyle extends CSSProperties {
  position: "absolute";
  top: number;
  left: number;
  width: string;
  transform: string;
}

export interface UseVirtualListResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: VirtualItem[];
  wrapperStyle: CSSProperties;
  getItemStyle: (virtualRow: VirtualItem) => VirtualListItemStyle;
}

const WRAPPER_STYLE_BASE: CSSProperties = {
  position: "relative",
  width: "100%",
  flexShrink: 0,
};

export function useVirtualList({
  count,
  estimateSize,
  resetKey,
  gap = 0,
  padding,
  overscan = 5,
  measureElement,
  scrollRef: scrollRefProp,
  resetScrollTop = false,
  infiniteScroll,
}: UseVirtualListOptions): UseVirtualListResult {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? internalScrollRef;

  const resolveEstimateSize = useCallback(
    () => (typeof estimateSize === "function" ? estimateSize() : estimateSize),
    [estimateSize],
  );

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scrollRef.current,
    estimateSize: resolveEstimateSize,
    overscan,
    gap,
    paddingStart: padding?.start,
    paddingEnd: padding?.end,
    measureElement,
  });

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (resetKey === undefined) return;
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    virtualizer.scrollToIndex(0);
    if (resetScrollTop && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [resetKey, resetScrollTop, scrollRef, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const loadMoreEnabled = infiniteScroll?.hasNextPage ?? false;
  const loadMoreFetching = infiniteScroll?.isFetchingNextPage ?? false;
  const loadMoreHandler = infiniteScroll?.onLoadMore;

  useEffect(() => {
    if (!loadMoreEnabled || loadMoreFetching || !loadMoreHandler) return;
    if (shouldLoadMore(virtualItems, count, virtualizer.options.overscan)) {
      loadMoreHandler();
    }
  }, [virtualItems, count, loadMoreEnabled, loadMoreFetching, loadMoreHandler, virtualizer]);

  const wrapperStyle: CSSProperties = {
    ...WRAPPER_STYLE_BASE,
    height: virtualizer.getTotalSize(),
  };

  const getItemStyle = useCallback(
    (virtualRow: VirtualItem): VirtualListItemStyle => ({
      position: "absolute",
      top: 0,
      left: 0,
      width: "100%",
      transform: `translateY(${virtualRow.start}px)`,
    }),
    [],
  );

  return {
    scrollRef,
    virtualizer,
    virtualItems,
    wrapperStyle,
    getItemStyle,
  };
}
