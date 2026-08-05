import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
import {
  buildAxisValueHierarchy,
  flattenAxisValueRows,
  type AxisValueHierarchyRow,
} from "../model/axisValueHierarchy";
import type { AxisId } from "../model/types";
import { I } from "../../../shared/ui/Icon";

// 軸レールのクイックオーバーレイ・「＋絞り込み」・チップの兄弟値ドロップダウン
// が共有する簡易値リスト。データ取得・フィルタ・ソートは値一覧本体
// （AxisValueList / axisValueFilter / axisValueSort / axisValueHierarchy）と同じロジックを
// 使い回し、描画だけを簡易化する（コラージュは持たない）。CV・サークルは数百〜数千件に
// なりうるため、値一覧本体（AxisValueRows）と同じ @tanstack/react-virtual で仮想化する
// （ADR-0012 §7: ホバーで開く導線が件数に耐えないと「素早い乗り換え」の前提が崩れる）。
// 入れ子タグは名前順ソート時のみインデント表示にする（値一覧と同じ規則）。

const INDENT_PER_DEPTH = 12;
/** 行の概算高さ（.mll-qlist__item / .mll-qlist__heading の padding 6px + 12px行 に一致） */
const ROW_ESTIMATE_SIZE = 29;
const LIST_PADDING = 4;

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

/** 見出し行（選択不可）を飛ばして次の値行のインデックスを探す。ラップアラウンドする。 */
function findNextValueIndex(rows: AxisValueHierarchyRow[], from: number, delta: 1 | -1): number {
  if (rows.length === 0) return -1;
  let index = from;
  for (let step = 0; step < rows.length; step++) {
    index = index + delta;
    if (index < 0) index = rows.length - 1;
    if (index >= rows.length) index = 0;
    if (rows[index]?.kind === "value") return index;
  }
  return -1;
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sortToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    setQuery("");
    setSort(DEFAULT_AXIS_VALUE_SORT);
    setSortMenuOpen(false);
  }, [axis]);

  const currentSortLabel = AXIS_VALUE_SORT_OPTIONS.find((opt) => opt.id === sort.key)?.label ?? "";

  const filtered = filterAxisValueItems(items, query);
  const rows =
    sort.key === "name"
      ? buildAxisValueHierarchy(filtered, sort.direction)
      : flattenAxisValueRows(sortAxisValueItems(filtered, sort));

  // 行はすべて固定高さ（見出し・値行とも1行に収まるよう nowrap+ellipsis で折り返しを禁止済み）。
  // DOM実測（measureElement + ref配線）はせず、estimateSize の定数をそのまま採用する。
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => ROW_ESTIMATE_SIZE,
    overscan: 8,
    gap: 1,
    paddingStart: LIST_PADDING,
    paddingEnd: LIST_PADDING,
  });

  const resetKey = `${axis}:${sort.key}:${sort.direction}:${query}`;
  const prevResetKeyRef = useRef(resetKey);
  // items（facet データ本体）の参照も見る。選択中タグの変化などで同じ軸・ソート・検索語の
  // まま中身だけ変わることがあり、resetKey の文字列比較だけでは検知できないため。
  const prevItemsRef = useRef(items);
  // キーボード移動中の「現在位置」を自前で追跡する（rows のインデックス、未選択は-1）。
  // document.activeElement から逆算すると、フォーカス確定（下記のダブルrAF）より速く
  // 次のキー入力が来た場合に取りこぼす（キーリピート等）。scrollToIndex/focus の実際の
  // 完了を待たず、常にこの ref を正として次の移動先を決める。
  const activeIndexRef = useRef(-1);
  useEffect(() => {
    if (prevResetKeyRef.current === resetKey && prevItemsRef.current === items) return;
    prevResetKeyRef.current = resetKey;
    prevItemsRef.current = items;
    activeIndexRef.current = -1;
    virtualizer.scrollToIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [resetKey, items, virtualizer]);

  // 仮想化中は範囲外の行がDOMに無いため、scrollToIndexで画面内へ入れてから
  // レイアウト確定後（ダブルrAF）にフォーカスする。
  const focusRowAfterRender = (index: number) => {
    activeIndexRef.current = index;
    virtualizer.scrollToIndex(index, { align: "auto" });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        listRef.current
          ?.querySelector<HTMLElement>(`[data-index="${index}"] [data-quicklist-item]`)
          ?.focus();
      });
    });
  };

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const nextIndex = findNextValueIndex(
      rows,
      activeIndexRef.current,
      event.key === "ArrowDown" ? 1 : -1,
    );
    if (nextIndex === -1) return;
    focusRowAfterRender(nextIndex);
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
      // activeIndexRef を使う（ハードコードで-1から始めない）。フォーカス移動が非同期
      // （ダブルrAF）のため、キーリピート等でこのハンドラが連続して呼ばれても
      // 常に「実際の現在位置」から次へ進む。
      const nextIndex = findNextValueIndex(rows, activeIndexRef.current, 1);
      if (nextIndex === -1) return;
      focusRowAfterRender(nextIndex);
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
        <button
          ref={sortToggleRef}
          type="button"
          className={`mll-qlist__sorttoggle ${sortMenuOpen ? "is-open" : ""}`}
          aria-haspopup="true"
          aria-expanded={sortMenuOpen}
          aria-label={`並び替え: ${currentSortLabel}`}
          title={`並び替え: ${currentSortLabel}`}
          onClick={() => setSortMenuOpen((open) => !open)}
        >
          <I.sort size={12} />
        </button>
      </div>
      {sortMenuOpen && (
        // 統括判断: 入れ子の浮遊レイヤーは作らず、パネル内にインライン展開する
        // （フォーカス管理・Escapeの二重化を避けるため）。
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ソート切替はボタン列で表現する
        <div className="mll-qlist__sort" role="group" aria-label="並び替え">
          {AXIS_VALUE_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`mll-qlist__sortbtn ${sort.key === opt.id ? "is-active" : ""}`}
              aria-pressed={sort.key === opt.id}
              onClick={() => {
                setSort(selectAxisValueSortKey(sort, opt.id));
                setSortMenuOpen(false);
                // 選択したボタンはこの直後に畳まれてDOMから消えるため、フォーカスが
                // bodyへ落ちる前にトグルボタンへ移しておく。
                sortToggleRef.current?.focus();
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      {hint && <div className="mll-qlist__hint">{hint}</div>}
      {isLoading ? (
        <div className="mll-qlist__status">読み込み中…</div>
      ) : isError ? (
        <div className="mll-qlist__status">取得に失敗しました</div>
      ) : rows.length === 0 ? (
        <div className="mll-qlist__status">{emptyLabel}</div>
      ) : (
        <div
          ref={listRef}
          className="mll-qlist__body"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値一覧と同じボタン一覧の表現を使う
          role="listbox"
          aria-label={getAxisLabel(axis)}
          onFocus={(e) => {
            // マウスクリック・Tab等、キーボード移動以外でフォーカスが動いた場合も
            // activeIndexRef を追従させる（次のキーボード移動が正しい位置から始まるように）。
            const indexAttr = e.target.closest("[data-index]")?.getAttribute("data-index");
            if (indexAttr !== null && indexAttr !== undefined) {
              activeIndexRef.current = Number(indexAttr);
            }
          }}
        >
          <div style={{ position: "relative", width: "100%", height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;
              const indent = row.depth * INDENT_PER_DEPTH;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.kind === "heading" ? (
                    <div className="mll-qlist__heading" style={{ paddingLeft: indent }}>
                      {row.label}
                    </div>
                  ) : (
                    (() => {
                      const on = isSelected(row.item.value);
                      return (
                        <button
                          type="button"
                          data-quicklist-item
                          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値一覧と同じボタン一覧の表現を使う
                          role="option"
                          aria-selected={on}
                          className={`mll-qlist__item ${on ? "is-on" : ""}`}
                          style={{ paddingLeft: 8 + indent }}
                          title={row.depth > 0 ? row.item.value : undefined}
                          onClick={(e) =>
                            onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                          }
                        >
                          <span className="nm">{row.label}</span>
                          <span className="count">{row.item.count}</span>
                        </button>
                      );
                    })()
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
