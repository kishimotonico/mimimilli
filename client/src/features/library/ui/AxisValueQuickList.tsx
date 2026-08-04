import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { AxisFacetItem } from "@mimimilli/shared";
import { getAxisLabel } from "../model/axisDefinitions";
import { filterAxisValueItems } from "../model/axisValueFilter";
import {
  AXIS_VALUE_SORT_OPTIONS,
  DEFAULT_AXIS_VALUE_SORT,
  selectAxisValueSortKey,
  sortAxisValueItems,
  type AxisValueSortState,
} from "../model/axisValueSort";
import { buildAxisValueHierarchy, flattenAxisValueRows } from "../model/axisValueHierarchy";
import type { AxisId } from "../model/types";
import { I } from "../../../shared/ui/Icon";

// 軸レールのクイックオーバーレイ・「＋絞り込み」・チップの兄弟値ドロップダウン
// が共有する簡易値リスト。データ取得・フィルタ・ソートは値一覧本体
// （AxisValueList / axisValueFilter / axisValueSort / axisValueHierarchy）と同じロジックを
// 使い回し、描画だけを簡易化する（コラージュ・仮想化はしない。ADR-0012 §7）。
// 入れ子タグは名前順ソート時のみインデント表示にする（値一覧と同じ規則）。

const INDENT_PER_DEPTH = 12;

interface AxisValueQuickListProps {
  axis: AxisId;
  items: AxisFacetItem[];
  isLoading?: boolean;
  isError?: boolean;
  isSelected: (tag: string) => boolean;
  /** 値を選択したときのハンドラ。Ctrl/Cmdキーで既定動作を反転する（呼び出し側が解釈する） */
  onSelect: (item: AxisFacetItem, event: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** 既定動作の説明（例:「クリックで置き換え」「AND追加されます」） */
  hint?: string;
  onClose: () => void;
  emptyLabel?: string;
}

export default function AxisValueQuickList({
  axis,
  items,
  isLoading,
  isError,
  isSelected,
  onSelect,
  hint,
  onClose,
  emptyLabel = "項目がありません",
}: AxisValueQuickListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AxisValueSortState>(DEFAULT_AXIS_VALUE_SORT);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    setQuery("");
    setSort(DEFAULT_AXIS_VALUE_SORT);
  }, [axis]);

  const filtered = filterAxisValueItems(items, query);
  const rows =
    sort.key === "name"
      ? buildAxisValueHierarchy(filtered, sort.direction)
      : flattenAxisValueRows(sortAxisValueItems(filtered, sort));

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>("[data-quicklist-item]") ?? [],
    );
    if (buttons.length === 0) return;
    const active = document.activeElement;
    const currentIndex = buttons.indexOf(active as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      currentIndex === -1
        ? delta > 0
          ? 0
          : buttons.length - 1
        : (currentIndex + delta + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      listRef.current?.querySelector<HTMLButtonElement>("[data-quicklist-item]")?.focus();
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 検索欄・ソート・一覧をまとめた矢印キー移動の委譲コンテナ（個々の子要素がフォーカス可能な実要素を持つ）
    <div className="mll-qlist" onKeyDown={handleListKeyDown}>
      <div className="mll-qlist__search">
        <I.search size={12} />
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={`${getAxisLabel(axis)}を検索`}
          aria-label={`${getAxisLabel(axis)}の値を検索`}
        />
      </div>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ソート切替はボタン列で表現する */}
      <div className="mll-qlist__sort" role="group" aria-label="並び替え">
        {AXIS_VALUE_SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={`mll-qlist__sortbtn ${sort.key === opt.id ? "is-active" : ""}`}
            aria-pressed={sort.key === opt.id}
            onClick={() => setSort(selectAxisValueSortKey(sort, opt.id))}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {hint && <div className="mll-qlist__hint">{hint}</div>}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値一覧と同じボタン一覧の表現を使う */}
      <div ref={listRef} className="mll-qlist__body" role="listbox" aria-label={getAxisLabel(axis)}>
        {isLoading ? (
          <div className="mll-qlist__status">読み込み中…</div>
        ) : isError ? (
          <div className="mll-qlist__status">取得に失敗しました</div>
        ) : rows.length === 0 ? (
          <div className="mll-qlist__status">{emptyLabel}</div>
        ) : (
          rows.map((row) => {
            const indent = row.depth * INDENT_PER_DEPTH;
            if (row.kind === "heading") {
              return (
                <div key={row.path} className="mll-qlist__heading" style={{ paddingLeft: indent }}>
                  {row.label}
                </div>
              );
            }
            const on = isSelected(row.item.value);
            return (
              <button
                key={row.path}
                type="button"
                data-quicklist-item
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値一覧と同じボタン一覧の表現を使う
                role="option"
                aria-selected={on}
                className={`mll-qlist__item ${on ? "is-on" : ""}`}
                style={{ paddingLeft: 8 + indent }}
                title={row.depth > 0 ? row.item.value : undefined}
                onClick={(e) => onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })}
              >
                <span className="nm">{row.label}</span>
                <span className="count">{row.item.count}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
