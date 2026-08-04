import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AxisFacetItem } from "@mimimilli/shared";
import type { AxisValueSortKey, AxisValueSortState } from "../model/axisValueSort";
import { AXIS_VALUE_SORT_OPTIONS, toggleAxisValueSort } from "../model/axisValueSort";
import { formatDuration } from "../../../shared/lib/format";
import { I } from "../../../shared/ui/Icon";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import CoverCollage from "./CoverCollage";
import IconButton from "../../../shared/ui/IconButton";
import type { IconName } from "../../../shared/ui/Icon";

const ROW_COLLAGE_SIZE = 32;

// 値一覧の list 表示（ADR-0012 §5）。2×2コラージュ(32px)/名前/件数/総時間 の列を持つ行。
// 列見出しクリックはソートメニューと同じ AxisValueSortState への別入口（axisValueSort.ts）。

/** AxisValueRow の概算高さ（WorkRow と同じ42px。CSS の block-size と一致させる） */
const ROW_ESTIMATE_SIZE = 42;
const LIST_PADDING_START = 4;
const LIST_PADDING_END = 4;

interface AxisValueRowsProps {
  items: AxisFacetItem[];
  sort: AxisValueSortState;
  onSortChange: (sort: AxisValueSortState) => void;
  isSelected: (item: AxisFacetItem) => boolean;
  fallbackIcon: IconName;
  /** 軸・並び順・検索語が変わったらスクロール位置をリセットするための key */
  resetKey: string;
  /** クリック（既定=置き換え）・Ctrl/Cmd+クリック（AND追加）（ADR-0012 §7） */
  onSelect: (item: AxisFacetItem, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時に出る＋ボタン（常にAND追加） */
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
  items,
  sort,
  onSortChange,
  isSelected,
  fallbackIcon,
  resetKey,
  onSelect,
  onAdd,
}: AxisValueRowsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  // コラージュは32pxを2×2に分割するので、各セルの要求サムネイル幅は半分の16pxを基準にする
  const collageRequestWidth = selectFixedCoverThumbnailWidth(
    ROW_COLLAGE_SIZE / 2,
    window.devicePixelRatio,
  );

  const measureElement = useCallback(() => ROW_ESTIMATE_SIZE, []);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: 8,
    gap: 1,
    paddingStart: LIST_PADDING_START,
    paddingEnd: LIST_PADDING_END,
    measureElement,
  });

  const prevResetKeyRef = useRef(resetKey);
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    virtualizer.scrollToIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [resetKey, virtualizer]);

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
      <div ref={listRef} className="mle-col__list" style={{ padding: 0 }}>
        <div style={{ position: "relative", width: "100%", height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = items[virtualRow.index];
            if (!item) return null;
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <div
                  className={`mll-vrow ${isSelected(item) ? "is-on" : ""}`}
                  // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- クリック領域(選択)とAND追加ボタンを両方内包するため<option>にはできない
                  role="option"
                  aria-selected={isSelected(item)}
                >
                  <button
                    type="button"
                    className="mll-vrow__main"
                    onClick={(e) => onSelect(item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
                  >
                    <CoverCollage
                      covers={item.covers}
                      size={ROW_COLLAGE_SIZE}
                      fallbackIcon={fallbackIcon}
                      requestWidth={collageRequestWidth}
                    />
                    <span className="mll-vrow__nm">{item.value}</span>
                    <span className="mll-vrow__count">{item.count}</span>
                    <span className="mll-vrow__dur">
                      {formatDuration(item.durationSec) ?? "0:00"}
                    </span>
                  </button>
                  <IconButton
                    icon={I.add}
                    label={`${item.value}をAND追加`}
                    size="xs"
                    className="mll-vrow__add"
                    onClick={() => onAdd(item)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
