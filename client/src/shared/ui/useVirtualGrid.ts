import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { useVirtualizer, type VirtualItem, type Virtualizer } from "@tanstack/react-virtual";
import {
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TILE_CHROME_HEIGHT,
  clampTileSize,
  computeGridColumnCount,
} from "../lib/gridSizing";
import { shouldLoadMore } from "../lib/virtualScroll";

export interface VirtualGridPadding {
  start?: number;
  end?: number;
}

export interface VirtualGridInfiniteScroll {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

export interface VirtualGridJustifiedLayout {
  rowCount: number;
  estimateRowSize: (index: number) => number;
  measureElement?: (element: HTMLDivElement) => number;
  layoutRevision: unknown;
}

export interface VirtualGridJustifiedOptions {
  getLayout: (containerWidth: number) => VirtualGridJustifiedLayout | null;
}

export interface UseVirtualGridOptions {
  itemCount: number;
  tileSize: number;
  resetKey: string;
  gap?: { row?: number; column?: number };
  padding?: VirtualGridPadding;
  overscan?: number;
  scrollRef?: RefObject<HTMLDivElement | null>;
  justified?: VirtualGridJustifiedOptions;
  infiniteScroll?: VirtualGridInfiniteScroll;
}

export interface VirtualGridItemStyle extends CSSProperties {
  position: "absolute";
  top: number;
  left: number;
  width: string;
  transform: string;
}

export interface UseVirtualGridResult {
  scrollRef: RefObject<HTMLDivElement | null>;
  setGridEl: (el: HTMLDivElement | null) => void;
  containerWidth: number;
  columnCount: number;
  rowCount: number;
  safeTileSize: number;
  justifiedLayout: VirtualGridJustifiedLayout | null;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  virtualItems: VirtualItem[];
  wrapperStyle: CSSProperties;
  getItemStyle: (virtualRow: VirtualItem) => VirtualGridItemStyle;
}

const WRAPPER_STYLE_BASE: CSSProperties = {
  position: "relative",
  width: "100%",
  flexShrink: 0,
};

export function useVirtualGrid({
  itemCount,
  tileSize,
  resetKey,
  gap,
  padding,
  overscan = 5,
  scrollRef: scrollRefProp,
  justified,
  infiniteScroll,
}: UseVirtualGridOptions): UseVirtualGridResult {
  const internalScrollRef = useRef<HTMLDivElement>(null);
  const scrollRef = scrollRefProp ?? internalScrollRef;
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const rowGap = gap?.row ?? GRID_ROW_GAP;
  const columnGap = gap?.column ?? GRID_COLUMN_GAP;
  const safeTileSize = clampTileSize(tileSize);

  useLayoutEffect(() => {
    if (!gridEl) return;
    setContainerWidth(gridEl.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [gridEl]);

  const columnCount = useMemo(
    () => computeGridColumnCount(containerWidth, safeTileSize, columnGap),
    [containerWidth, safeTileSize, columnGap],
  );

  const getJustifiedLayout = justified?.getLayout;
  const justifiedLayout = useMemo(
    () => (getJustifiedLayout ? getJustifiedLayout(containerWidth) : null),
    [getJustifiedLayout, containerWidth],
  );

  const squareRowCount = useMemo(
    () => Math.ceil(itemCount / columnCount),
    [itemCount, columnCount],
  );

  const rowCount = justifiedLayout?.rowCount ?? squareRowCount;

  const squareEstimateSize = useCallback(() => {
    const tileWidth =
      containerWidth > 0
        ? (containerWidth - (columnCount - 1) * columnGap) / columnCount
        : safeTileSize;
    return tileWidth + GRID_TILE_CHROME_HEIGHT;
  }, [columnCount, columnGap, containerWidth, safeTileSize]);

  const estimateSize = useCallback(
    (index: number) => {
      if (justifiedLayout) return justifiedLayout.estimateRowSize(index);
      return squareEstimateSize();
    },
    [justifiedLayout, squareEstimateSize],
  );

  const measureElement = useMemo(() => {
    if (!justifiedLayout?.measureElement) return undefined;
    return (element: Element) => {
      if (!(element instanceof HTMLDivElement)) return 0;
      return justifiedLayout.measureElement!(element);
    };
  }, [justifiedLayout]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan,
    gap: rowGap,
    paddingStart: padding?.start,
    paddingEnd: padding?.end,
    measureElement,
  });

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    virtualizer.scrollToIndex(0);
  }, [resetKey, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();

  const loadMoreEnabled = infiniteScroll?.hasNextPage ?? false;
  const loadMoreFetching = infiniteScroll?.isFetchingNextPage ?? false;
  const loadMoreHandler = infiniteScroll?.onLoadMore;

  useEffect(() => {
    if (!loadMoreEnabled || loadMoreFetching || !loadMoreHandler) return;
    if (shouldLoadMore(virtualItems, rowCount, virtualizer.options.overscan)) {
      loadMoreHandler();
    }
  }, [virtualItems, rowCount, loadMoreEnabled, loadMoreFetching, loadMoreHandler, virtualizer]);

  const justifiedLayoutRevision = justifiedLayout?.layoutRevision;

  useEffect(() => {
    if (justifiedLayoutRevision === undefined) return;
    virtualizer.measure();
  }, [justifiedLayoutRevision, virtualizer]);

  const wrapperStyle: CSSProperties = {
    ...WRAPPER_STYLE_BASE,
    height: `${virtualizer.getTotalSize()}px`,
    "--tile-size": `${safeTileSize}px`,
    "--grid-row-gap": `${rowGap}px`,
    "--grid-col-gap": `${columnGap}px`,
    "--tile-chrome-h": `${GRID_TILE_CHROME_HEIGHT}px`,
  } as CSSProperties;

  const getItemStyle = useCallback(
    (virtualRow: VirtualItem): VirtualGridItemStyle => ({
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
    setGridEl,
    containerWidth,
    columnCount,
    rowCount,
    safeTileSize,
    justifiedLayout,
    virtualizer,
    virtualItems,
    wrapperStyle,
    getItemStyle,
  };
}
