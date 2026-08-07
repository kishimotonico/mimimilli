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
import type { AxisValueHierarchyRow, AxisValueValueRow } from "../model/axisValueHierarchy";
import { I, type IconName } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";
import IconButton from "../../../shared/ui/IconButton";

// 値一覧の grid 表示（ADR-0012 §5）。代表カバー2×2コラージュ＋名前＋件数バッジのタイル。
// 列数・タイルサイズの計算は作品グリッド（WorkGrid）と同じ gridSizing を共有する。
// justified レイアウトは対象外（コラージュは常に正方形）。
// 入れ子タグ（名前順ソート時）は axisValueHierarchy.ts の階層行のうち値行だけをタイルにし、
// 実タグとして存在しない中間ノード（見出し）はタイル化できないため飛ばす。depth>0 のタイルは
// 親パスを小さいパンくずとして葉ラベルの上に添える。

const GRID_PADDING_START = 16;
const GRID_PADDING_END = 16;

/** 親パス（葉の1つ上の階層まで）。depth===0 なら親は無い。 */
function parentPathOf(row: AxisValueValueRow): string | null {
  const idx = row.path.lastIndexOf("/");
  return idx <= 0 ? null : row.path.slice(0, idx);
}

interface AxisValueGridProps {
  axisLabel: string;
  rows: AxisValueHierarchyRow[];
  tileSize: number;
  isSelected: (item: AxisFacetItem) => boolean;
  fallbackIcon: IconName;
  resetKey: string;
  /** クリック（既定=置き換え）・Ctrl/Cmd+クリック（AND追加）（ADR-0012 §7） */
  onSelect: (item: AxisFacetItem, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時に出る＋ボタン（冪等なAND追加。選択済み行には出さない） */
  onAdd: (item: AxisFacetItem) => void;
}

export default function AxisValueGrid({
  axisLabel,
  rows,
  tileSize,
  isSelected,
  fallbackIcon,
  resetKey,
  onSelect,
  onAdd,
}: AxisValueGridProps) {
  const items = useMemo(
    () => rows.filter((row): row is AxisValueValueRow => row.kind === "value"),
    [rows],
  );
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
      <div
        ref={scrollRef}
        className="mll-grid-scroll"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
        role="group"
        aria-label={`${axisLabel}の値一覧`}
      >
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
                {rowItems.map((row) => {
                  // depth>0（名前順ソートの階層モード）のときだけパンくずを出す。件数・総時間
                  // ソートのフォールバック（depth は常に0）は label がフルパスなので不要。
                  const parentPath = row.depth > 0 ? parentPathOf(row) : null;
                  const on = isSelected(row.item);
                  return (
                    <div key={row.path} className={`mll-vtile ${on ? "is-on" : ""}`}>
                      <button
                        type="button"
                        className="mll-vtile__main"
                        title={parentPath ? row.item.value : undefined}
                        aria-pressed={on}
                        onClick={(e) =>
                          onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                        }
                      >
                        <CoverCollage
                          covers={row.item.covers}
                          fallbackIcon={fallbackIcon}
                          requestWidth={collageRequestWidth}
                        />
                        {parentPath && <span className="mll-vtile__breadcrumb">{parentPath}</span>}
                        <span className="mll-vtile__nm">{row.label}</span>
                        <span className="mll-vtile__badge">{row.item.count} 件</span>
                      </button>
                      {!on && (
                        <IconButton
                          icon={I.add}
                          label={`${row.item.value}をAND追加`}
                          size="xs"
                          variant="bare"
                          className="mll-vtile__add"
                          onClick={() => onAdd(row.item)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
