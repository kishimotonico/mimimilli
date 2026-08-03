import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import type { SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../model/types";
import { activeAxisAtom, sortAtom } from "../model/atoms";
import { useLibraryNavigation } from "../model/useLibraryNavigation";
import { isSmartAxis, getSmartFolderId } from "../model/axisDefinitions";
import { listSmartFolders } from "../api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { usePopoverDismissal } from "./preview/useAnchoredPopover";

const SMART_FOLDER_SORT_TOOLTIP = "並び順はスマートフォルダーの設定に従います";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

export default function LibrarySortMenu() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const sort = useAtomValue(sortAtom);
  const { setSort } = useLibraryNavigation();
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

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
  const currentSortLabel = displaySort ? getSortLabel(displaySort) : undefined;
  const disabled = onSmartAxis;

  const buttonTitle = disabled
    ? currentSortLabel
      ? `${SMART_FOLDER_SORT_TOOLTIP}（${currentSortLabel}）`
      : SMART_FOLDER_SORT_TOOLTIP
    : currentSortLabel
      ? `並び替え: ${currentSortLabel}`
      : "並び替え";

  useEffect(() => {
    if (disabled && sortMenuOpen) setSortMenuOpen(false);
  }, [disabled, sortMenuOpen]);

  usePopoverDismissal({
    isOpen: sortMenuOpen && !disabled,
    onOutsideClick: () => setSortMenuOpen(false),
    onEscape: () => setSortMenuOpen(false),
    anchorRef: sortRef,
  });

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
          if (!disabled) setSortMenuOpen((v) => !v);
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
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={sort === opt.id}
              className={`mle-sortmenu__item ${sort === opt.id ? "is-checked" : ""}`}
              onClick={() => {
                setSort(opt.id);
                setSortMenuOpen(false);
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
