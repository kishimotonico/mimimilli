import { I } from "../../shared/ui/Icon";

interface LeftNavProps {
  mode?: "library" | "files";
  onModeChange?: (mode: "library" | "files") => void;
  playingCount?: number;
}

export default function LeftNav({
  mode = "library",
  onModeChange,
  playingCount = 0,
}: LeftNavProps) {
  return (
    <aside className="mle-side">
      <div className="mle-side__group">
        <div className="mle-side__hd">モード</div>
        <button
          className={`mle-side__btn is-mode ${mode === "files" ? "is-on" : ""}`}
          onClick={() => onModeChange?.("files")}
          title="ファイル"
        >
          <span className="mle-side__icbox"><I.folderO size={20} /></span>
          ファイル
        </button>
        <button
          className={`mle-side__btn is-mode ${mode === "library" ? "is-on" : ""}`}
          onClick={() => onModeChange?.("library")}
        >
          <span className="mle-side__icbox"><I.gridS size={18} /></span>
          ライブラリ
        </button>
      </div>

      <div className="mle-side__group">
        <button className={`mle-side__btn ${playingCount > 0 ? "has-badge" : ""}`}>
          <span className="mle-side__icbox"><I.audio size={18} /></span>
          再生中
          {playingCount > 0 && <span className="mle-side__badge">{playingCount}</span>}
        </button>
        <button className="mle-side__btn">
          <span className="mle-side__icbox"><I.refresh size={18} /></span>
          履歴
        </button>
        <button className="mle-side__btn">
          <span className="mle-side__icbox"><I.star size={18} /></span>
          お気に入り
        </button>
        <button className="mle-side__btn">
          <span className="mle-side__icbox"><I.bookmark size={18} /></span>
          ピン留め
        </button>
      </div>

      <div className="mle-side__sp" />

      <div className="mle-side__group" style={{ borderTop: "none" }}>
        <button className="mle-side__btn">
          <span className="mle-side__icbox"><I.user size={18} /></span>
          自分
        </button>
      </div>
    </aside>
  );
}
