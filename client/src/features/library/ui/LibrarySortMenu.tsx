import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAtom, useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import type { SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../model/types";
import { activeAxisAtom, axisValueSortAtom, sortAtom } from "../model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { isSmartAxis, getSmartFolderId } from "../model/axisDefinitions";
import { computeResultsPaneKind } from "../model/libraryPresentation";
import {
  AXIS_VALUE_SORT_OPTIONS,
  selectAxisValueSortKey,
  type AxisValueSortKey,
} from "../model/axisValueSort";
import { listSmartFolders } from "../api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { usePopoverDismissal } from "../../../shared/ui/usePopoverDismissal";

const SMART_FOLDER_SORT_TOOLTIP = "並び順はスマートフォルダーの設定に従います";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

function getAxisValueSortLabel(key: AxisValueSortKey): string {
  return AXIS_VALUE_SORT_OPTIONS.find((opt) => opt.id === key)?.label ?? key;
}

// ADR-0012 帰結: ソートは UI が単一系・state が二重。結果面が値一覧のときは
// axisValueSortAtom（名前/件数/総時間）、作品一覧のときは従来の sortAtom を
// このメニューの接続先として切り替える。値一覧のソート状態と作品一覧のソート状態は
// 別々に保持したまま、UI 側だけが結果面の内容に応じてどちらへ書き込むかを決める。
export default function LibrarySortMenu() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const sort = useAtomValue(sortAtom);
  const { setSort } = useLibraryNavigation();
  const [axisValueSort, setAxisValueSort] = useAtom(axisValueSortAtom);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const isValueListPane = computeResultsPaneKind(activeAxis) === "value-list";
  const onSmartAxis = isSmartAxis(activeAxis);
  const smartFoldersQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
    enabled: onSmartAxis,
  });

  const smartFolderSort = onSmartAxis
    ? smartFoldersQuery.data?.find((sf) => sf.id === getSmartFolderId(activeAxis))?.sort
    : null;

  const displaySort = onSmartAxis ? smartFolderSort : sort;
  const currentSortLabel = isValueListPane
    ? getAxisValueSortLabel(axisValueSort.key)
    : displaySort
      ? getSortLabel(displaySort)
      : undefined;
  const disabled = onSmartAxis;

  const buttonTitle = disabled
    ? currentSortLabel
      ? `${SMART_FOLDER_SORT_TOOLTIP}（${currentSortLabel}）`
      : SMART_FOLDER_SORT_TOOLTIP
    : currentSortLabel
      ? `並び替え: ${currentSortLabel}`
      : "並び替え";

  const { close: closeSortMenu } = usePopoverDismissal({
    isOpen: sortMenuOpen && !disabled,
    onClose: () => setSortMenuOpen(false),
    anchorRef: sortRef,
  });

  useEffect(() => {
    if (disabled && sortMenuOpen) closeSortMenu();
  }, [disabled, sortMenuOpen, closeSortMenu]);

  // role=menu の期待どおり、開いたら現在値（無ければ先頭）へ初期フォーカスする。
  useEffect(() => {
    if (!sortMenuOpen || disabled) return;
    const items = sortRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]');
    if (!items || items.length === 0) return;
    const checked = Array.from(items).find((item) => item.getAttribute("aria-checked") === "true");
    (checked ?? items[0])?.focus();
  }, [sortMenuOpen, disabled]);

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLButtonElement);
    const delta = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = (currentIndex + delta + items.length) % items.length;
    items[nextIndex]?.focus();
  };

  return (
    <div className="mle-sortmenu" ref={sortRef}>
      <IconButton
        size="sm"
        icon={I.sort}
        label="並び替え"
        title={buttonTitle}
        active={sortMenuOpen}
        disabled={disabled}
        aria-haspopup={disabled ? undefined : "menu"}
        aria-expanded={disabled ? undefined : sortMenuOpen}
        onClick={() => {
          if (!disabled) {
            if (sortMenuOpen) closeSortMenu();
            else setSortMenuOpen(true);
          }
        }}
      />
      {sortMenuOpen && !disabled && (
        <div
          className="mle-sortmenu__pop"
          role="menu"
          aria-label="並び替え"
          tabIndex={-1}
          onKeyDown={handleMenuKeyDown}
        >
          {isValueListPane
            ? AXIS_VALUE_SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={axisValueSort.key === opt.id}
                  className={`mle-sortmenu__item ${axisValueSort.key === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    setAxisValueSort(selectAxisValueSortKey(axisValueSort, opt.id));
                    closeSortMenu();
                  }}
                >
                  <span className="check">
                    {axisValueSort.key === opt.id && <I.check size={14} />}
                  </span>
                  <span className="label">{opt.label}</span>
                </button>
              ))
            : SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sort === opt.id}
                  className={`mle-sortmenu__item ${sort === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    setSort(opt.id);
                    closeSortMenu();
                  }}
                >
                  <span className="check">{sort === opt.id && <I.check size={14} />}</span>
                  <span className="label">{opt.label}</span>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}
