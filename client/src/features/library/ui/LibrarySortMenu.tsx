import { useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { useQuery } from "@tanstack/react-query";
import type { SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../model/types";
import { activeAxisAtom, sortAtom } from "../model/atoms";
import { setLibrarySortAtom } from "../model/libraryNavigationActions";
import { isSmartAxis, getSmartFolderId } from "../model/axisDefinitions";
import { listSmartFolders } from "../api";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";

const SMART_FOLDER_SORT_TOOLTIP = "並び順はスマートフォルダーの設定に従います";

function getSortLabel(sortId: SortId): string | undefined {
  return SORT_OPTIONS.find((opt) => opt.id === sortId)?.label;
}

export default function LibrarySortMenu() {
  const activeAxis = useAtomValue(activeAxisAtom);
  const sort = useAtomValue(sortAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
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

  useEffect(() => {
    if (!sortMenuOpen || disabled) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [sortMenuOpen, disabled]);

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
        <div className="mle-sortmenu__pop" role="menu" aria-label="並び替え">
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
