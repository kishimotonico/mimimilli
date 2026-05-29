import { I } from "../Icon";

interface AddressBarProps {
  path: string[];
  onNavigate?: (index: number) => void;
  onBack?: () => void;
  onForward?: () => void;
  canBack?: boolean;
  canForward?: boolean;
  viewMode?: "column" | "list" | "grid";
  onViewChange?: (v: "column" | "list" | "grid") => void;
  onSort?: () => void;
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
  onSort,
}: AddressBarProps) {
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

      <button className="mle-navbtn" title="並び替え" onClick={onSort}>
        <I.sort size={13} />
      </button>
      <button className="mle-navbtn" title="その他">
        <I.more size={14} />
      </button>
    </div>
  );
}
