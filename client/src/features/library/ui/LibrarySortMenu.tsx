import { useEffect, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { SORT_OPTIONS } from "../model/types";
import { sortAtom } from "../model/atoms";
import { setLibrarySortAtom } from "../model/libraryNavigationActions";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";

export default function LibrarySortMenu() {
  const sort = useAtomValue(sortAtom);
  const setSort = useSetAtom(setLibrarySortAtom);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.id === sort)?.label;

  useEffect(() => {
    if (!sortMenuOpen) return;

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
  }, [sortMenuOpen]);

  return (
    <div className="mle-sortmenu" ref={sortRef}>
      <IconButton
        size="sm"
        icon={I.sort}
        label="並び替え"
        title={currentSortLabel ? `並び替え: ${currentSortLabel}` : "並び替え"}
        active={sortMenuOpen}
        aria-haspopup="menu"
        aria-expanded={sortMenuOpen}
        onClick={() => setSortMenuOpen((v) => !v)}
      />
      {sortMenuOpen && (
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
