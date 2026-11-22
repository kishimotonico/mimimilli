import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NO_AUTOFILL_PROPS } from "../../../shared/ui/noAutofill";
import { useAtom } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { GroupBy, GroupValueItem } from "@mimimilli/shared";
import {
  GROUP_VALUE_SORT_OPTIONS,
  toggleGroupValueSort,
  type GroupValueSortState,
} from "../model/groupValueSort";
import { groupValueSortAtom } from "../model/atoms";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import { buildGroupValueDisplayRows } from "../model/groupValueDisplayRows";
import { isGroupValueRowArrowKey } from "../model/groupValueRowNav";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { useGroupValueListNav } from "./useGroupValueListNav";

// サイドバーのクイックオーバーレイ・「＋絞り込み」・チップの兄弟値ドロップダウン
// が共有する簡易値リスト。データ取得・フィルタ・ソートは値一覧本体
// （GroupValueList / groupValueFilter / groupValueSort / groupValueHierarchy）と同じロジックを
// 使い回し、描画だけを簡易化する（コラージュは持たない）。CV・サークルは数百〜数千件に
// なりうるため、値一覧本体（GroupValueRows）と同じ @tanstack/react-virtual で仮想化する
// （ADR-0012 §7: ホバーで開く導線が件数に耐えないと「素早い乗り換え」の前提が崩れる）。
// 入れ子タグは名前順ソート時のみインデント表示にする（値一覧と同じ規則）。

const INDENT_PER_DEPTH = 12;
/** 行の概算高さ（.mll-qlist__item / .mll-qlist__heading の padding 6px + 12px行 に一致） */
const ROW_ESTIMATE_SIZE = 29;
const LIST_PADDING = 4;

interface GroupValueQuickListProps {
  groupBy: GroupBy;
  /** 表示用のグループ分けのラベル。呼び出し側が tagPrefixes を解決して渡す
   *  （getGroupByLabel(groupBy) を tagPrefixes なしで呼ぶと未登録prefixでIDがそのまま出るため） */
  groupByLabel: string;
  /** 呼び出し側の開閉状態。AnimatePresence の退出アニメーション中に isOpen=false のまま
   *  グループ分けが変わらず再オープンされるケース（Escapeで閉じてすぐ同じグループ分けを開き直す等）でも
   *  検索欄へフォーカスし直すため、groupBy 単体ではなくこの値の変化も見る */
  isOpen: boolean;
  items: GroupValueItem[];
  isLoading?: boolean;
  isError?: boolean;
  isSelected: (tag: string) => boolean;
  /** 値を選択したときのハンドラ。Ctrl/Cmdキーで既定動作を反転する（呼び出し側が解釈する） */
  onSelect: (item: GroupValueItem, event: { ctrlKey: boolean; metaKey: boolean }) => void;
  /** ホバー/フォーカス時に出る＋ボタン（冪等なAND追加。選択済み行には出さない）。
   *  省略時はボタンを出さない（ADR-0013） */
  onAdd?: (item: GroupValueItem) => void;
  /** useAnchoredPopover / usePopoverDismissal が返す close をそのまま渡す */
  close: () => void;
  emptyLabel?: string;
}

interface SortMenuProps {
  sort: GroupValueSortState;
  onToggle: (id: (typeof GROUP_VALUE_SORT_OPTIONS)[number]["id"]) => void;
}

/** ソート切替メニュー。height:0↔auto の collapse で開閉する。
 *  `.mll-qlist__sort` 自体は padding/border-bottom を持つ実要素のため、
 *  overflow:hidden で高さをクリップする役割はこの外側の motion.div が担う。 */
function SortMenu({ sort, onToggle }: SortMenuProps) {
  const { collapse } = useMotionVariants();
  const isPresent = useIsPresent();
  const v = collapse();
  return (
    <motion.div style={{ overflow: "hidden" }} inert={!isPresent} {...v}>
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ソート切替はボタン列で表現する */}
      <div className="mll-qlist__sort" role="group" aria-label="並び替え">
        {GROUP_VALUE_SORT_OPTIONS.map((opt) => {
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

export default function GroupValueQuickList({
  groupBy,
  groupByLabel,
  isOpen,
  items,
  isLoading,
  isError,
  isSelected,
  onSelect,
  onAdd,
  close,
  emptyLabel = "項目がありません",
}: GroupValueQuickListProps) {
  const groupKey = groupByKey(groupBy);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useAtom(groupValueSortAtom);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const sortToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // 退出中（isOpen=false）は何もしない。closeDelay中に isOpen が再び true に
    // なったときは グループ分けが変わっていなくても改めて発火させたいので、依存配列に
    // groupBy だけでなく isOpen も含める。
    if (!isOpen) return;
    searchRef.current?.focus({ preventScroll: true });
    setQuery("");
    setSortMenuOpen(false);
  }, [groupKey, isOpen]);

  const currentSortLabel = GROUP_VALUE_SORT_OPTIONS.find((opt) => opt.id === sort.key)?.label ?? "";

  const rows = buildGroupValueDisplayRows(items, query, sort);
  const resetKey = `${groupKey}:${sort.key}:${sort.direction}:${query}`;

  const {
    scrollRef,
    virtualItems,
    wrapperStyle,
    getItemStyle,
    rovingIndex,
    moveFocus,
    handleListFocus,
  } = useGroupValueListNav({
    rows,
    virtualList: {
      estimateSize: ROW_ESTIMATE_SIZE,
      // resetKey（グループ分け・ソート・検索語）が変わらない限り位置をリセットしない。AND追加ボタンで
      // items の参照だけが変わっても、スクロール位置・キーボード位置は維持する
      // （ADR-0013: AND追加はオーバーレイを開いたまま連続で行える）。
      resetKey,
      gap: 1,
      padding: { start: LIST_PADDING, end: LIST_PADDING },
      overscan: 8,
    },
    itemSelector: (index) => `[data-index="${index}"] [data-quicklist-item]`,
  });

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    const key = event.key;
    if (!isGroupValueRowArrowKey(key)) return;
    // Home/Endは検索入力欄のカーソル移動（ネイティブ動作）を横取りしない。矢印キーは
    // 検索欄側が個別処理する（handleSearchKeyDown）ため、ここへは既に処理済みで届かない。
    if ((key === "Home" || key === "End") && event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    moveFocus(key);
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
      moveFocus("ArrowDown");
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 検索欄・ソート・一覧をまとめた矢印キー移動の委譲コンテナ（個々の子要素がフォーカス可能な実要素を持つ）
    <div className="mll-qlist" onKeyDown={handleListKeyDown}>
      <div className="mll-qlist__search">
        <I.search size={12} />
        <input
          {...NO_AUTOFILL_PROPS}
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={`${groupByLabel}を検索`}
          aria-label={`${groupByLabel}の値を検索`}
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
        // 入れ子の浮遊レイヤーは作らず、パネル内にインライン展開する
        // （フォーカス管理・Escapeの二重化を避けるため）。
      }
      <AnimatePresence>
        {sortMenuOpen && (
          <SortMenu
            key="sort-menu"
            sort={sort}
            onToggle={(id) => setSort(toggleGroupValueSort(sort, id))}
          />
        )}
      </AnimatePresence>
      {isLoading ? (
        <div className="mll-qlist__status">読み込み中…</div>
      ) : isError ? (
        <div className="mll-qlist__status">取得に失敗しました</div>
      ) : rows.length === 0 ? (
        <div className="mll-qlist__status">{emptyLabel}</div>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onFocusはキーボード移動位置の追従用。フォーカスは子のボタンが受ける
        <div
          ref={scrollRef}
          className="mll-qlist__body"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
          role="group"
          aria-label={`${groupByLabel}の値一覧`}
          onFocus={handleListFocus}
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
                  style={getItemStyle(virtualRow)}
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
                            tabIndex={virtualRow.index === rovingIndex ? 0 : -1}
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
