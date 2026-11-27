import { useEffect, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { NO_AUTOFILL_PROPS } from "../../../shared/ui/noAutofill";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import type { GroupBy, GroupSortId, GroupValueItem } from "@mimimilli/shared";
import {
  GROUP_SORT_COLUMNS,
  getGroupSortLabel,
  groupSortColumn,
  groupSortDirection,
  toggleGroupSortColumn,
  type GroupSortColumn,
} from "../model/groupValueSort";
import { groupByKey } from "../../../entities/smart-folder/groupByKey";
import { buildGroupValueDisplayRows } from "../model/groupValueDisplayRows";
import { isGroupValueRowArrowKey } from "../model/groupValueRowNav";
import { I } from "../../../shared/ui/Icon";
import { MENU_COUNT_CLASS, MENU_LABEL_CLASS } from "../../../shared/ui/menu/menuStyles";
import { popoverListItemClass } from "../../../shared/ui/popover/popoverStyles";
import IconButton from "../../../shared/ui/IconButton";
import { useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { useGroupValueListNav } from "./useGroupValueListNav";

// サイドバーのクイックオーバーレイ・「＋絞り込み」・チップの兄弟値ドロップダウン
// が共有する簡易値リスト。データ取得・フィルタ・並びの規則は値一覧本体
// （GroupValueList / groupValueFilter / groupValueSort / groupValueHierarchy）と同じロジックを
// 使い回し、描画だけを簡易化する（コラージュは持たない）。CV・サークルは数百〜数千件に
// なりうるため、値一覧本体（GroupValueRows）と同じ @tanstack/react-virtual で仮想化する
// （ADR-0012 §7: ホバーで開く導線が件数に耐えないと「素早い乗り換え」の前提が崩れる）。
// 入れ子タグは名前順ソート時のみインデント表示にする（値一覧と同じ規則）。

const INDENT_PER_DEPTH = 12;
/** popoverListItemClass / .mll-qlist__heading の高さに合わせる。 */
const ROW_ESTIMATE_SIZE = 28;

interface GroupValueQuickListProps {
  groupBy: GroupBy;
  /** 表示用のグループ分けのラベル。呼び出し側が tagPrefixes を解決して渡す
   *  （getGroupByLabel(groupBy) を tagPrefixes なしで呼ぶと未登録prefixでIDがそのまま出るため） */
  groupByLabel: string;
  items: GroupValueItem[];
  /** 今の並び。サーバーがこの順で返す。開いている間だけの一時状態で、保存はしない */
  sort: GroupSortId;
  onSortChange: (sort: GroupSortId) => void;
  isLoading?: boolean;
  isError?: boolean;
  isSelected: (tag: string) => boolean;
  /** 値を選択したときのハンドラ。修飾キーでも動きは同じ（ADR-0041） */
  onSelect: (item: GroupValueItem) => void;
  /** ホバー/フォーカス時に出る＋ボタン（冪等なAND追加。選択済み行には出さない）。
   *  省略時はボタンを出さない（ADR-0013） */
  onAdd?: (item: GroupValueItem) => void;
}

interface SortMenuProps {
  sort: GroupSortId;
  onToggle: (column: GroupSortColumn) => void;
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
      <div className="mll-qlist__sort" role="group" aria-label="ソート">
        {GROUP_SORT_COLUMNS.map((opt) => {
          const isActive = groupSortColumn(sort) === opt.id;
          const direction = groupSortDirection(sort);
          const directionLabel = isActive ? (direction === "asc" ? "昇順" : "降順") : null;
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
                <span className={`chev ${direction === "asc" ? "is-asc" : ""}`}>
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
  items,
  sort,
  onSortChange,
  isLoading,
  isError,
  isSelected,
  onSelect,
  onAdd,
}: GroupValueQuickListProps) {
  const groupKey = groupByKey(groupBy);
  const [query, setQuery] = useState("");
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const isPresent = useIsPresent();

  useEffect(() => {
    if (!isPresent) return;
    setQuery("");
    setSortMenuOpen(false);
  }, [groupKey, isPresent]);

  const currentSortLabel = getGroupSortLabel(sort, groupBy);

  const rows = buildGroupValueDisplayRows(items, query, sort);
  const resetKey = `${groupKey}:${sort}:${query}`;

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
      overscan: 8,
    },
    itemSelector: (index) => `[data-index="${index}"] [data-quicklist-item]`,
  });

  const handleListKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const key = event.key;
    if (!isGroupValueRowArrowKey(key)) return;
    // Home/Endは検索入力欄のカーソル移動（ネイティブ動作）を横取りしない。矢印キーは
    // 検索欄側が個別処理する（handleSearchKeyDown）ため、ここへは既に処理済みで届かない。
    if ((key === "Home" || key === "End") && event.target instanceof HTMLInputElement) return;
    event.preventDefault();
    moveFocus(key);
  };

  const handleSearchKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      moveFocus("ArrowDown");
    }
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- 検索欄・ソート・一覧をまとめた矢印キー移動の委譲コンテナ（個々の子要素がフォーカス可能な実要素を持つ）
    <div className="mll-qlist" data-search-shortcut-scope onKeyDown={handleListKeyDown}>
      <div className="mll-qlist__search">
        <I.search size={12} />
        <input
          {...NO_AUTOFILL_PROPS}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={`${groupByLabel}を検索`}
          aria-label={`${groupByLabel}を検索`}
        />
        <button
          type="button"
          className={`mll-qlist__sorttoggle ${sortMenuOpen ? "is-open" : ""}`}
          aria-haspopup="true"
          aria-expanded={sortMenuOpen}
          aria-label={`ソート: ${currentSortLabel}`}
          title={`ソート: ${currentSortLabel}`}
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
            onToggle={(column) => onSortChange(toggleGroupSortColumn(sort, column))}
          />
        )}
      </AnimatePresence>
      {isLoading ? (
        <div className="mll-qlist__status">読み込み中…</div>
      ) : isError ? (
        <div className="mll-qlist__status">取得に失敗しました</div>
      ) : rows.length === 0 ? (
        <div className="mll-qlist__status">{groupByLabel}がありません</div>
      ) : (
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- onFocusはキーボード移動位置の追従用。フォーカスは子のボタンが受ける
        <div
          ref={scrollRef}
          className="mll-qlist__body"
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- 値ボタン集合を名前付き集合として表す。fieldset等の代替タグは適合しない
          role="group"
          aria-label={`${groupByLabel}の一覧`}
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
                    <div className="mll-qlist__heading" style={{ paddingLeft: 8 + indent }}>
                      {row.label}
                    </div>
                  ) : (
                    (() => {
                      const on = isSelected(row.item.value);
                      return (
                        <div className="mll-qlist__row">
                          <button
                            type="button"
                            data-quicklist-item
                            className={popoverListItemClass}
                            tabIndex={virtualRow.index === rovingIndex ? 0 : -1}
                            style={{ paddingLeft: 8 + indent, paddingRight: onAdd && !on ? 26 : 8 }}
                            title={row.depth > 0 ? row.item.value : undefined}
                            aria-pressed={on}
                            onClick={() => onSelect(row.item)}
                          >
                            <span className="mll-qlist__check" aria-hidden="true">
                              {on && <I.check size={12} />}
                            </span>
                            <span className={MENU_LABEL_CLASS}>{row.label}</span>
                            <span className={MENU_COUNT_CLASS}>{row.item.count}</span>
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
