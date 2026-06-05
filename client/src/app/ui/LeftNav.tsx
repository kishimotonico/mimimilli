import React from "react";
import { I } from "../../shared/ui/Icon";

interface LeftNavProps {
  mode?: "library" | "files";
  onModeChange?: (mode: "library" | "files") => void;
  playingCount?: number;
}

const IconSet = I as Record<string, (p: { size?: number }) => React.ReactElement>;

interface SurfaceItem {
  icon: string;
  label: string;
  badge?: number;
}

const SURFACES: SurfaceItem[] = [
  { icon: "audio", label: "再生中" },
  { icon: "refresh", label: "履歴" },
  { icon: "star", label: "お気に入り" },
  { icon: "bookmark", label: "ピン留め" },
];

export default function LeftNav({ mode = "library", onModeChange, playingCount = 0 }: LeftNavProps) {
  return (
    <aside className="mle-side">
      <div className="mle-side__group is-mode">
        <button
          className={`mle-side__btn ${mode === "files" ? "is-on" : ""}`}
          onClick={() => onModeChange?.("files")}
          title="ファイル"
          aria-label="ファイル"
          aria-pressed={mode === "files"}
        >
          <I.folderO size={20} />
        </button>
        <button
          className={`mle-side__btn ${mode === "library" ? "is-on" : ""}`}
          onClick={() => onModeChange?.("library")}
          title="ライブラリ"
          aria-label="ライブラリ"
          aria-pressed={mode === "library"}
        >
          <I.gridS size={19} />
        </button>
      </div>

      <div className="mle-side__group">
        {SURFACES.map((s) => {
          const Ic = IconSet[s.icon] ?? I.folder;
          const badge = s.label === "再生中" ? playingCount : s.badge;
          return (
            <button key={s.label} className="mle-side__btn" title={s.label} aria-label={s.label}>
              <Ic size={19} />
              {badge != null && badge > 0 && <span className="mle-side__badge">{badge}</span>}
            </button>
          );
        })}
      </div>

      <div className="mle-side__sp" />

      <div className="mle-side__group is-foot">
        <button className="mle-side__btn" title="自分" aria-label="自分">
          <I.user size={19} />
        </button>
      </div>
    </aside>
  );
}
