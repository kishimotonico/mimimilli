import { useCallback } from "react";
import type { AxisFacetItem } from "@mimimilli/shared";
import type { AxisValueSortKey, AxisValueSortState } from "../model/axisValueSort";
import { AXIS_VALUE_SORT_OPTIONS, toggleAxisValueSort } from "../model/axisValueSort";
import type { AxisValueHierarchyRow } from "../model/axisValueHierarchy";
import { formatDuration } from "../../../shared/lib/format";
import { I } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";
import IconButton from "../../../shared/ui/IconButton";
import type { IconName } from "../../../shared/ui/Icon";
import { useVirtualList } from "../../../shared/ui/useVirtualList";

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
  /** クリック（既定=置き換え）・Ctrl/Cmd+クリック（AND追加）（ADR-0012 §7） */
  onSelect: (item: AxisFacetItem, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時に出る＋ボタン（冪等なAND追加。選択済み行には出さない） */
  onAdd: (item: AxisFacetItem) => void;
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
  onAdd,
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
      <div
        ref={scrollRef}
        className="mle-col__list"
        style={{ padding: 0 }}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
        role="group"
        aria-label={`${axisLabel}の値一覧`}
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
                          style={{ paddingLeft: 4 + indent }}
                          title={row.depth > 0 ? row.item.value : undefined}
                          aria-pressed={on}
                          onClick={(e) =>
                            onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                          }
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
                        {!on && (
                          <IconButton
                            icon={I.add}
                            label={`${row.item.value}をAND追加`}
                            size="xs"
                            variant="bare"
                            className="mll-vrow__add"
                            onClick={() => onAdd(row.item)}
                          />
                        )}
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
