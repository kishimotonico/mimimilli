import { useEffect, useRef, useState } from "react";
import { useAtom } from "jotai";
import type { SortId } from "@mimimilli/shared";
import { SORT_OPTIONS } from "../../features/library/model/types";
import { libraryViewModeAtom } from "../../features/library/model/atoms";
import LibraryGridControls from "../../features/library/ui/LibraryGridControls";
import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

interface AddressBarProps {
  mode: "library" | "files";
  path: string[];
  onNavigate?: (index: number) => void;
  onBack?: () => void;
  onForward?: () => void;
  canBack?: boolean;
  canForward?: boolean;
  showSort?: boolean;
  sort?: SortId;
  onSortChange?: (sort: SortId) => void;
}

export default function AddressBar({
  mode,
  path,
  onNavigate,
  onBack,
  onForward,
  canBack = false,
  canForward = false,
  showSort = false,
  sort,
  onSortChange,
}: AddressBarProps) {
  const [libraryViewMode, setLibraryViewMode] = useAtom(libraryViewModeAtom);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const currentSortLabel = SORT_OPTIONS.find((opt) => opt.id === sort)?.label;
  const viewMode = mode === "library" ? libraryViewMode : "column";
  const availableViewModes: readonly ("column" | "list" | "grid")[] =
    mode === "library" ? ["list", "grid"] : ["column"];

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
    <div className="mle-addr is-lib">
      <IconButton size="sm" icon={I.arrowL} label="戻る" onClick={onBack} disabled={!canBack} />
      <IconButton
        size="sm"
        icon={I.arrowR}
        label="進む"
        onClick={onForward}
        disabled={!canForward}
      />

      <div className="mle-crumbs">
        {path.map((seg, i) => (
          <span key={i} style={{ display: "contents" }}>
            {i > 0 && <span className="mle-crumbs__sep">/</span>}
            <button
              className={`mle-crumbs__seg ${i === path.length - 1 ? "is-last" : ""}`}
              onClick={() => onNavigate?.(i)}
            >
              {seg}
            </button>
          </span>
        ))}
      </div>

      {mode === "library" && <LibraryGridControls />}

      <div className="inline-flex items-center gap-[1px] rounded-2 bg-paper-2 p-[2px]">
        <IconButton
          size="sm"
          icon={I.gridS}
          label="カラム"
          active={viewMode === "column"}
          disabled={!availableViewModes.includes("column")}
        />
        <IconButton
          size="sm"
          icon={I.list}
          label="リスト"
          active={viewMode === "list"}
          onClick={() => setLibraryViewMode("list")}
          disabled={!availableViewModes.includes("list")}
        />
        <IconButton
          size="sm"
          icon={I.grid}
          label="グリッド"
          active={viewMode === "grid"}
          onClick={() => setLibraryViewMode("grid")}
          disabled={!availableViewModes.includes("grid")}
        />
      </div>

      {showSort && (
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
                    onSortChange?.(opt.id);
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
      )}
      <IconButton size="sm" icon={I.more} label="その他" />
    </div>
  );
}
