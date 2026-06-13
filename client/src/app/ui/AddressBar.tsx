import { useEffect, useRef, useState } from "react";
import type { SortId } from "@mimikago/shared";
import { SORT_OPTIONS } from "../../features/library/model/types";
import { I } from "../../shared/ui/Icon";

interface AddressBarProps {
  path: string[];
  onNavigate?: (index: number) => void;
  onBack?: () => void;
  onForward?: () => void;
  canBack?: boolean;
  canForward?: boolean;
  viewMode?: "column" | "list" | "grid";
  onViewChange?: (v: "column" | "list" | "grid") => void;
  showSort?: boolean;
  sort?: SortId;
  onSortChange?: (sort: SortId) => void;
}

export default function AddressBar({
  path,
  onNavigate,
  onBack,
  onForward,
  canBack = false,
  canForward = false,
  viewMode = "column",
  onViewChange,
  showSort = false,
  sort,
  onSortChange,
}: AddressBarProps) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

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
      <button
        className={`mle-navbtn ${!canBack ? "is-disabled" : ""}`}
        onClick={onBack}
        disabled={!canBack}
        title="戻る"
      >
        <I.arrowL size={14} />
      </button>
      <button
        className={`mle-navbtn ${!canForward ? "is-disabled" : ""}`}
        onClick={onForward}
        disabled={!canForward}
        title="進む"
      >
        <I.arrowR size={14} />
      </button>

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

      <div className="mle-addr__vtoggle">
        <button
          className={viewMode === "column" ? "is-on" : ""}
          title="カラム"
          onClick={() => onViewChange?.("column")}
        >
          <I.gridS size={13} />
        </button>
        <button
          className={viewMode === "list" ? "is-on" : ""}
          title="リスト"
          onClick={() => onViewChange?.("list")}
        >
          <I.list size={14} />
        </button>
        <button
          className={viewMode === "grid" ? "is-on" : ""}
          title="グリッド"
          onClick={() => onViewChange?.("grid")}
        >
          <I.grid size={13} />
        </button>
      </div>

      {showSort && (
        <div className="mle-sortmenu" ref={sortRef}>
          <button
            className={`mle-navbtn ${sortMenuOpen ? "is-on" : ""}`}
            title="並び替え"
            aria-label="並び替え"
            aria-haspopup="menu"
            aria-expanded={sortMenuOpen}
            onClick={() => setSortMenuOpen((v) => !v)}
          >
            <I.sort size={13} />
          </button>
          {sortMenuOpen && (
            <div className="mle-sortmenu__pop" role="menu">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  role="menuitemradio"
                  aria-checked={sort === opt.id}
                  className={`mle-sortmenu__item ${sort === opt.id ? "is-checked" : ""}`}
                  onClick={() => {
                    onSortChange?.(opt.id);
                    setSortMenuOpen(false);
                  }}
                >
                  <span className="check">
                    {sort === opt.id && <I.x size={9} style={{ transform: "rotate(45deg)" }} />}
                  </span>
                  <span className="label">{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <button className="mle-navbtn" title="その他">
        <I.more size={14} />
      </button>
    </div>
  );
}
