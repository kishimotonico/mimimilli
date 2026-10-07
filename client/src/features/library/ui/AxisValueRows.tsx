import { useCallback, useEffect, useState } from "react";
import type { AxisFacetItem } from "@mimimilli/shared";
import type { AxisValueSortKey, AxisValueSortState } from "../model/axisValueSort";
import { AXIS_VALUE_SORT_OPTIONS, toggleAxisValueSort } from "../model/axisValueSort";
import type { AxisValueHierarchyRow } from "../model/axisValueHierarchy";
import {
  getNextAxisValueRowIndex,
  nearestValueRowIndex,
  type AxisValueRowArrowKey,
} from "../model/axisValueRowNav";
import { formatDuration } from "../../../shared/lib/format";
import { I } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";
import type { IconName } from "../../../shared/ui/Icon";
import { useVirtualList } from "../../../shared/ui/useVirtualList";
import { useRovingIndex } from "./useRovingIndex";
import { focusVirtualItem } from "../../../shared/lib/focusVirtualItem";

const ROW_ARROW_KEYS = new Set<AxisValueRowArrowKey>(["ArrowUp", "ArrowDown", "Home", "End"]);

const ROW_COLLAGE_SIZE = 32;
/** 階層1段あたりのインデント幅。深さに制限は設けない（4階層以上でも破綻しない）。 */
const INDENT_PER_DEPTH = 14;

// 値一覧の list 表示（ADR-0012 §5）。2×2コラージュ(32px)/名前/件数/総時間 の列を持つ行。
// 列見出しクリックはソートメニューと同じ AxisValueSortState への別入口（axisValueSort.ts）。
// 入れ子タグ（名前順ソート時のみ）は axisValueHierarchy.ts の階層行を depth ぶんインデントし、
// 実タグとして存在しない中間ノードは選択不可の見出し行として描画する。

/** AxisValueRow の概算高さ（WorkRow と同じ42px。CSS の block-size と一致させる）。
 *  見出し行も同じ高さにして仮想化の可変高さ対応を避ける。 */
const ROW_ESTIMATE_SIZE = 42;
const LIST_PADDING_START = 4;
const LIST_PADDING_END = 4;

interface AxisValueRowsProps {
  axisLabel: string;
  rows: AxisValueHierarchyRow[];
  sort: AxisValueSortState;
  onSortChange: (sort: AxisValueSortState) => void;
  isSelected: (item: AxisFacetItem) => boolean;
  fallbackIcon: IconName;
  /** 軸・並び順・検索語が変わったらスクロール位置をリセットするための key */
  resetKey: string;
  /** クリック（既定=置き換え）・Ctrl/Cmd+クリック（トグル、ADR-0012 §7・ADR-0013の
   *  作品詳細タグクリックと同型）。値一覧は独立した全作品入口のためAND追加ボタンは
   *  持たない。 */
  onSelect: (item: AxisFacetItem, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
}

function SortHeaderButton({
  sortKey,
  label,
  align,
  sort,
  onSortChange,
}: {
  sortKey: AxisValueSortKey;
  label: string;
  align: "start" | "end";
  sort: AxisValueSortState;
  onSortChange: (sort: AxisValueSortState) => void;
}) {
  const isActive = sort.key === sortKey;
  const directionLabel = isActive ? (sort.direction === "asc" ? "昇順" : "降順") : null;
  return (
    <button
      type="button"
      className={`mll-vlist-hd__sort ${isActive ? "is-active" : ""}`}
      style={align === "start" ? { justifyContent: "flex-start" } : undefined}
      aria-label={directionLabel ? `${label}（${directionLabel}）` : label}
      onClick={() => onSortChange(toggleAxisValueSort(sort, sortKey))}
    >
      {label}
      {isActive && (
        <span className={`chev ${sort.direction === "asc" ? "is-asc" : ""}`}>
          <I.chevD size={11} />
        </span>
      )}
    </button>
  );
}

export default function AxisValueRows({
  axisLabel,
  rows,
  sort,
  onSortChange,
  isSelected,
  fallbackIcon,
  resetKey,
  onSelect,
}: AxisValueRowsProps) {
  // コラージュは32pxを2×2に分割するので、各セルの要求サムネイル幅は半分の16pxを基準にする
  const collageRequestWidth = selectFixedCoverThumbnailWidth(
    ROW_COLLAGE_SIZE / 2,
    window.devicePixelRatio,
  );

  const measureElement = useCallback(() => ROW_ESTIMATE_SIZE, []);
  const { scrollRef, virtualizer, virtualItems, wrapperStyle, getItemStyle } = useVirtualList({
    count: rows.length,
    estimateSize: ROW_ESTIMATE_SIZE,
    resetKey,
    resetScrollTop: true,
    gap: 1,
    padding: { start: LIST_PADDING_START, end: LIST_PADDING_END },
    overscan: 8,
    measureElement,
  });

  // roving tabindexの現在位置。値の選択は多重（タグ集合）で「現在の1件」が無いため、
  // 作品一覧（選択作品を対象にする）とは異なり、フォーカス移動
  // だけで独立管理する。-1は「まだ矢印キー・Tabで触れていない」を表す。
  const [activeIndex, setActiveIndex] = useState(-1);
  useEffect(() => {
    setActiveIndex(-1);
  }, [resetKey]);
  const rawRovingIndex = useRovingIndex({
    itemCount: rows.length,
    targetIndex: activeIndex >= 0 ? activeIndex : null,
    virtualItems,
    toRowIndex: (index) => index,
    firstFlatIndexOfRow: (index) => index,
  });
  const rovingIndex = nearestValueRowIndex(rows, rawRovingIndex);

  const moveRowFocus = (currentIndex: number, key: AxisValueRowArrowKey) => {
    const listEl = scrollRef.current;
    if (!listEl) return;
    const nextIndex = getNextAxisValueRowIndex(rows, currentIndex, key);
    if (nextIndex === -1 || nextIndex === currentIndex) return;
    setActiveIndex(nextIndex);
    focusVirtualItem(listEl, virtualizer, nextIndex, `[data-flat-index="${nextIndex}"]`);
  };

  return (
    <>
      <div className="mll-vlist-hd">
        <span aria-hidden="true" />
        {AXIS_VALUE_SORT_OPTIONS.map((opt) => (
          <SortHeaderButton
            key={opt.id}
            sortKey={opt.id}
            label={opt.label}
            align={opt.id === "name" ? "start" : "end"}
            sort={sort}
            onSortChange={onSortChange}
          />
        ))}
      </div>
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onFocusはキーボード移動位置の追従用。フォーカスは子のボタンが受ける */}
      <div
        ref={scrollRef}
        className="mle-col__list"
        style={{ padding: 0 }}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
        role="group"
        aria-label={`${axisLabel}の値一覧`}
        onFocus={(e) => {
          const indexAttr = e.target.closest("[data-flat-index]")?.getAttribute("data-flat-index");
          if (indexAttr !== null && indexAttr !== undefined) setActiveIndex(Number(indexAttr));
        }}
      >
        <div style={wrapperStyle}>
          {virtualItems.map((virtualRow) => {
            const row = rows[virtualRow.index];
            if (!row) return null;
            const indent = row.depth * INDENT_PER_DEPTH;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={getItemStyle(virtualRow)}
              >
                {row.kind === "heading" ? (
                  <div className="mll-vrow-heading" style={{ paddingLeft: indent }}>
                    {row.label}
                  </div>
                ) : (
                  (() => {
                    const on = isSelected(row.item);
                    return (
                      <div className={`mll-vrow ${on ? "is-on" : ""}`}>
                        <button
                          type="button"
                          className="mll-vrow__main"
                          data-flat-index={virtualRow.index}
                          tabIndex={virtualRow.index === rovingIndex ? 0 : -1}
                          style={{ paddingLeft: 4 + indent }}
                          title={row.depth > 0 ? row.item.value : undefined}
                          aria-pressed={on}
                          onClick={(e) =>
                            onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                          }
                          onKeyDown={(e) => {
                            if (!ROW_ARROW_KEYS.has(e.key as AxisValueRowArrowKey)) return;
                            e.preventDefault();
                            moveRowFocus(virtualRow.index, e.key as AxisValueRowArrowKey);
                          }}
                        >
                          <CoverCollage
                            covers={row.item.covers}
                            size={ROW_COLLAGE_SIZE}
                            fallbackIcon={fallbackIcon}
                            requestWidth={collageRequestWidth}
                          />
                          <span className="mll-vrow__nm">{row.label}</span>
                          <span className="mll-vrow__count">{row.item.count}</span>
                          <span className="mll-vrow__dur">
                            {formatDuration(row.item.durationSec) ?? "0:00"}
                          </span>
                        </button>
                      </div>
                    );
                  })()
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
