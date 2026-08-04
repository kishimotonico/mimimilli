import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AxisFacetItem } from "@mimimilli/shared";
import {
  GRID_COLUMN_GAP,
  GRID_ROW_GAP,
  GRID_TILE_CHROME_HEIGHT,
  clampTileSize,
  computeGridColumnCount,
} from "../model/gridSizing";
import type { IconName } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";

// 値一覧の grid 表示（ADR-0012 §5）。代表カバー2×2コラージュ＋名前＋件数バッジのタイル。
// 列数・タイルサイズの計算は作品グリッド（WorkGrid）と同じ gridSizing を共有する。
// justified レイアウトは対象外（コラージュは常に正方形）。

const GRID_PADDING_START = 16;
const GRID_PADDING_END = 16;

interface AxisValueGridProps {
  items: AxisFacetItem[];
  tileSize: number;
  isSelected: (item: AxisFacetItem) => boolean;
  fallbackIcon: IconName;
  resetKey: string;
  onToggle: (item: AxisFacetItem) => void;
}

export default function AxisValueGrid({
  items,
  tileSize,
  isSelected,
  fallbackIcon,
  resetKey,
  onToggle,
}: AxisValueGridProps) {
  const safeTileSize = clampTileSize(tileSize);
  // コラージュはタイルを2×2に分割するので、各セルの要求サムネイル幅はタイル幅の半分を基準にする
  const collageRequestWidth = selectFixedCoverThumbnailWidth(
    safeTileSize / 2,
    window.devicePixelRatio,
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

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
    () => computeGridColumnCount(containerWidth, safeTileSize, GRID_COLUMN_GAP),
    [containerWidth, safeTileSize],
  );
  const rowCount = Math.ceil(items.length / columnCount);

  const estimateSize = useMemo(() => {
    const tileWidth =
      containerWidth > 0
        ? (containerWidth - (columnCount - 1) * GRID_COLUMN_GAP) / columnCount
        : safeTileSize;
    return () => tileWidth + GRID_TILE_CHROME_HEIGHT;
  }, [containerWidth, columnCount, safeTileSize]);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize,
    overscan: 5,
    gap: GRID_ROW_GAP,
    paddingStart: GRID_PADDING_START,
    paddingEnd: GRID_PADDING_END,
  });

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    virtualizer.scrollToIndex(0);
  }, [resetKey, virtualizer]);

  return (
    <div className="mll-grid-body">
      <div ref={scrollRef} className="mll-grid-scroll">
        <div
          ref={setGridEl}
          className="mll-grid"
          style={
            {
              position: "relative",
              width: "100%",
              height: `${virtualizer.getTotalSize()}px`,
              "--tile-size": `${safeTileSize}px`,
              "--grid-row-gap": `${GRID_ROW_GAP}px`,
              "--grid-col-gap": `${GRID_COLUMN_GAP}px`,
              "--tile-chrome-h": `${GRID_TILE_CHROME_HEIGHT}px`,
            } as CSSProperties
          }
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const start = virtualRow.index * columnCount;
            const rowItems = items.slice(start, start + columnCount);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={
                  {
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                    gap: `${GRID_COLUMN_GAP}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  } as CSSProperties
                }
              >
                {rowItems.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    className={`mll-vtile ${isSelected(item) ? "is-on" : ""}`}
                    aria-pressed={isSelected(item)}
                    onClick={() => onToggle(item)}
                  >
                    <CoverCollage
                      covers={item.covers}
                      fallbackIcon={fallbackIcon}
                      requestWidth={collageRequestWidth}
                    />
                    <span className="mll-vtile__nm">{item.value}</span>
                    <span className="mll-vtile__badge">{item.count} 件</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
