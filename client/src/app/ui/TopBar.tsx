import { I } from "../../shared/ui/Icon";
import IconButton from "../../shared/ui/IconButton";

interface TopBarProps {
  mode?: "library" | "files";
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onScan?: () => void;
  onSettings?: () => void;
  isPlaying?: boolean;
  playingTrack?: string;
}

export default function TopBar({
  mode = "library",
  searchQuery,
  onSearchChange,
  onScan,
  onSettings,
  isPlaying = false,
  playingTrack,
}: TopBarProps) {
  const placeholder =
    mode === "files"
      ? "このフォルダー内を検索（ファイル名 · 拡張子 ...）"
      : "ライブラリを検索（タイトル · CV · タグ · RJ ...）";

  return (
    <header className="mll-bar">
      <div className="mll-bar__brand">
        <div className="mll-bar__mark">m</div>
        <div className="mll-bar__name">mimimilli</div>
      </div>

      {isPlaying && playingTrack && (
        <>
          <div className="mll-bar__divider" />
          <div className="mll-bar__pulse">
            <span className="dot" />
            <span className="ch">1ch</span>
            <span className="sep">·</span>
            <span className="lbl">{playingTrack}</span>
          </div>
        </>
      )}

      <div className="mll-bar__spacer" />

      <div className="mll-bar__search">
        <I.search size={13} />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
        />
        <span className="kbd">⌘K</span>
      </div>

      <IconButton size="md" icon={I.refresh} label="スキャン" onClick={onScan} />
      <IconButton size="md" icon={I.bell} label="通知" />
      <IconButton size="md" icon={I.cog} label="設定" onClick={onSettings} />
    </header>
  );
}
