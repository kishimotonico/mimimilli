import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { AxisFacetItem } from "@mimimilli/shared";
import { filterAxisValueItems } from "../model/axisValueFilter";
import {
  AXIS_VALUE_SORT_OPTIONS,
  DEFAULT_AXIS_VALUE_SORT,
  sortAxisValueItems,
  toggleAxisValueSort,
  type AxisValueSortState,
} from "../model/axisValueSort";
import {
  buildAxisValueHierarchy,
  flattenAxisValueRows,
  type AxisValueHierarchyRow,
} from "../model/axisValueHierarchy";
import type { AxisId } from "../model/types";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";

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
  /** 表示用の軸ラベル。呼び出し側が tagPrefixes を解決して渡す
   *  （getAxisLabel(axis) を tagPrefixes なしで呼ぶと未登録prefixでIDがそのまま出るため） */
  axisLabel: string;
  /** 呼び出し側の開閉状態。AnimatePresence の退出アニメーション中に isOpen=false のまま
   *  axis が変わらず再オープンされるケース（Escapeで閉じてすぐ同じ軸を開き直す等）でも
   *  検索欄へフォーカスし直すため、axis 単体ではなくこの値の変化も見る */
  isOpen: boolean;
  items: AxisFacetItem[];
  isLoading?: boolean;
  isError?: boolean;
  isSelected: (tag: string) => boolean;
  /** 値を選択したときのハンドラ。Ctrl/Cmdキーで既定動作を反転する（呼び出し側が解釈する） */
  onSelect: (item: AxisFacetItem, event: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時に出る＋ボタン（冪等なAND追加。選択済み行には出さない）。
   *  省略時はボタンを出さない（ADR-0013） */
  onAdd?: (item: AxisFacetItem) => void;
  /** 既定動作の説明（例:「クリックで置き換え」「AND追加されます」） */
  hint?: string;
  /** useAnchoredPopover / usePopoverDismissal が返す close をそのまま渡す */
  close: () => void;
  emptyLabel?: string;
}

interface SortMenuProps {
  sort: AxisValueSortState;
  onToggle: (id: (typeof AXIS_VALUE_SORT_OPTIONS)[number]["id"]) => void;
}

/** ソート切替メニュー。height:0↔auto の collapse で開閉する。
 *  `.mll-qlist__sort` 自体は padding/border-bottom を持つ実要素のため、
 *  overflow:hidden で高さをクリップする役目はこの外側の motion.div が担う。 */
function SortMenu({ sort, onToggle }: SortMenuProps) {
  const { collapse } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = collapse();
  return (
    <motion.div
      style={{ overflow: "hidden" }}
      inert={!isPresent}
      initial={v.initial}
      animate={v.animate}
      exit={v.exit}
    >
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ソート切替はボタン列で表現する */}
      <div className="mll-qlist__sort" role="group" aria-label="並び替え">
        {AXIS_VALUE_SORT_OPTIONS.map((opt) => {
          const isActive = sort.key === opt.id;
          const directionLabel = isActive ? (sort.direction === "asc" ? "昇順" : "降順") : null;
          return (
            <button
              key={opt.id}
              type="button"
              className={`mll-qlist__sortbtn ${isActive ? "is-active" : ""}`}
              aria-pressed={isActive}
              aria-label={directionLabel ? `${opt.label}（${directionLabel}）` : opt.label}
              onClick={() => onToggle(opt.id)}
            >
              {opt.label}
              {isActive && (
                <span className={`chev ${sort.direction === "asc" ? "is-asc" : ""}`}>
                  <I.chevD size={11} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
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
  axisLabel,
  isOpen,
  items,
  isLoading,
  isError,
  isSelected,
  onSelect,
  onAdd,
  hint,
  close,
  emptyLabel = "項目がありません",
}: AxisValueQuickListProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AxisValueSortState>(DEFAULT_AXIS_VALUE_SORT);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sortToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 退出中（isOpen=false）は何もしない。closeDelay中に isOpen が再び true に
    // なったときは axis が変わっていなくても改めて発火させたいので、依存配列に
    // axis だけでなく isOpen も含める。
    if (!isOpen) return;
    searchRef.current?.focus();
    setQuery("");
    setSort(DEFAULT_AXIS_VALUE_SORT);
    setSortMenuOpen(false);
  }, [axis, isOpen]);

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
  // キーボード移動中の「現在位置」を自前で追跡する（rows のインデックス、未選択は-1）。
  // document.activeElement から逆算すると、フォーカス確定（下記のダブルrAF）より速く
  // 次のキー入力が来た場合に取りこぼす（キーリピート等）。scrollToIndex/focus の実際の
  // 完了を待たず、常にこの ref を正として次の移動先を決める。
  const activeIndexRef = useRef(-1);
  useEffect(() => {
    // resetKey（軸・ソート・検索語）が変わらない限りリセットしない。AND追加ボタンで
    // selectedTags が変わると facet データが再取得され items の参照だけ変わるが、
    // 見ている対象は変わっていないためスクロール位置・キーボード位置は維持する
    // （ADR-0013: AND追加はオーバーレイを開いたまま連続で行える）。
    if (prevResetKeyRef.current === resetKey) return;
    prevResetKeyRef.current = resetKey;
    activeIndexRef.current = -1;
    virtualizer.scrollToIndex(0);
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [resetKey, virtualizer]);

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
      close();
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
      close();
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
          placeholder={`${axisLabel}を検索`}
          aria-label={`${axisLabel}の値を検索`}
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
      {
        // 統括判断: 入れ子の浮遊レイヤーは作らず、パネル内にインライン展開する
        // （フォーカス管理・Escapeの二重化を避けるため）。
      }
      <AnimatePresence>
        {sortMenuOpen && (
          <SortMenu
            key="sort-menu"
            sort={sort}
            onToggle={(id) => setSort(toggleAxisValueSort(sort, id))}
          />
        )}
      </AnimatePresence>
      {hint && <div className="mll-qlist__hint">{hint}</div>}
      {isLoading ? (
        <div className="mll-qlist__status">読み込み中…</div>
      ) : isError ? (
        <div className="mll-qlist__status">取得に失敗しました</div>
      ) : rows.length === 0 ? (
        <div className="mll-qlist__status">{emptyLabel}</div>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onFocusはキーボード移動位置の追従用。フォーカスは子のボタンが受ける
        <div
          ref={listRef}
          className="mll-qlist__body"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
          role="group"
          aria-label={`${axisLabel}の値一覧`}
          onFocus={(e) => {
            // マウスクリック・Tab等、キーボード移動以外でフォーカスが動いた場合も
            // activeIndexRef を追従させる（次のキーボード移動が正しい位置から始まるように）。
            const indexAttr = e.target.closest("[data-index]")?.getAttribute("data-index");
            if (indexAttr !== null && indexAttr !== undefined) {
              activeIndexRef.current = Number(indexAttr);
            }
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              height: virtualizer.getTotalSize(),
              flexShrink: 0,
            }}
          >
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
                        <div className={`mll-qlist__row ${on ? "is-on" : ""}`}>
                          <button
                            type="button"
                            data-quicklist-item
                            className={`mll-qlist__item ${on ? "is-on" : ""}`}
                            style={{ paddingLeft: 8 + indent, paddingRight: onAdd ? 26 : 8 }}
                            title={row.depth > 0 ? row.item.value : undefined}
                            aria-pressed={on}
                            onClick={(e) =>
                              onSelect(row.item, { ctrlKey: e.ctrlKey, metaKey: e.metaKey })
                            }
                          >
                            <span className="nm">{row.label}</span>
                            <span className="count">{row.item.count}</span>
                          </button>
                          {onAdd && !on && (
                            <IconButton
                              icon={I.add}
                              label={`${row.item.value}をAND追加`}
                              size="xs"
                              variant="bare"
                              className="mll-qlist__add"
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
      )}
    </div>
  );
}
