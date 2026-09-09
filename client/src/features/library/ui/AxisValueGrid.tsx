import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { AxisFacetItem } from "@mimimilli/shared";
import type { AxisValueHierarchyRow, AxisValueValueRow } from "../model/axisValueHierarchy";
import { GRID_COLUMN_GAP } from "../../../shared/lib/gridSizing";
import {
  firstFlatIndexOfRow,
  rowIndexOfFlatIndex,
  type GridArrowKey,
} from "../../../shared/lib/gridNavigation";
import { I, type IconName } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";
import IconButton from "../../../shared/ui/IconButton";
import { useVirtualGrid } from "../../../shared/ui/useVirtualGrid";
import { useGridKeyboardNav } from "./useGridKeyboardNav";
import { useRovingIndex } from "./useRovingIndex";

// 値一覧の grid 表示（ADR-0012 §5）。代表カバー2×2コラージュ＋名前＋件数バッジのタイル。
// 列数・タイルサイズの計算は作品グリッド（WorkGrid）と同じ gridSizing を共有する。
// justified レイアウトは対象外（コラージュは常に正方形）。
// 入れ子タグ（名前順ソート時）は axisValueHierarchy.ts の階層行のうち値行だけをタイルにし、
// 実タグとして存在しない中間ノード（見出し）はタイル化できないため飛ばす。depth>0 のタイルは
// 親パスを小さいパンくずとして葉ラベルの上に添える。

const GRID_PADDING_START = 16;
const GRID_PADDING_END = 16;

const GRID_ARROW_KEYS = new Set<GridArrowKey>([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
]);

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

  const {
    scrollRef,
    setGridEl: setGridElFromHook,
    columnCount,
    safeTileSize,
    virtualizer,
    virtualItems,
    wrapperStyle,
    getItemStyle,
  } = useVirtualGrid({
    itemCount: items.length,
    tileSize,
    resetKey,
    padding: { start: GRID_PADDING_START, end: GRID_PADDING_END },
  });

  const [gridEl, setGridEl] = useState<HTMLDivElement | null>(null);
  const setGridContainer = (el: HTMLDivElement | null) => {
    setGridElFromHook(el);
    setGridEl(el);
  };

  const collageRequestWidth = selectFixedCoverThumbnailWidth(
    safeTileSize / 2,
    window.devicePixelRatio,
  );

  // roving tabindexの現在位置。値の選択は多重（タグ集合）で「現在の1件」が無いため、
  // 作品グリッドの選択追従（useRovingIndex+selectedWorkId）とは異なり、フォーカス移動
  // だけで独立管理する。
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    setActiveIndex(-1);
  }, [resetKey]);
  const targetIndex = activeIndex >= 0 ? activeIndex : 0;
  const rovingIndex = useRovingIndex({
    itemCount: items.length,
    targetIndex,
    virtualItems,
    virtualizer,
    toRowIndex: (flatIndex) => rowIndexOfFlatIndex(flatIndex, false, null, columnCount) ?? 0,
    firstFlatIndexOfRow: (rowIndex) => firstFlatIndexOfRow(rowIndex, false, null, columnCount),
  });

  const moveTileFocus = useGridKeyboardNav({
    gridEl,
    isJustified: false,
    justifiedLayout: null,
    columnCount,
    items,
    onFocusItem: (_item, index) => setActiveIndex(index),
    virtualizer,
  });

  return (
    <div className="mll-grid-body">
      <div
        ref={scrollRef}
        className="mll-grid-scroll"
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
        role="group"
        aria-label={`${axisLabel}の値一覧`}
      >
        <div ref={setGridContainer} className="mll-grid" style={wrapperStyle as CSSProperties}>
          {virtualItems.map((virtualRow) => {
            const start = virtualRow.index * columnCount;
            const rowItems = items.slice(start, start + columnCount);
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={
                  {
                    ...getItemStyle(virtualRow),
                    display: "grid",
                    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
                    gap: `${GRID_COLUMN_GAP}px`,
                  } as CSSProperties
                }
              >
                {rowItems.map((row, localIndex) => {
                  const flatIndex = start + localIndex;
                  const parentPath = row.depth > 0 ? parentPathOf(row) : null;
                  const on = isSelected(row.item);
                  return (
                    <div key={row.path} className={`mll-vtile ${on ? "is-on" : ""}`}>
                      <button
                        type="button"
                        className="mll-vtile__main"
                        data-flat-index={flatIndex}
                        tabIndex={flatIndex === rovingIndex ? 0 : -1}
                        title={parentPath ? row.item.value : undefined}
                        aria-pressed={on}
                        onClick={(e) =>
                          onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                        }
                        onKeyDown={(e) => {
                          if (!GRID_ARROW_KEYS.has(e.key as GridArrowKey)) return;
                          e.preventDefault();
                          moveTileFocus(flatIndex, e.key as GridArrowKey);
                        }}
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
