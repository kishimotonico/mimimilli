import type { PlayerState } from "../../hooks/usePlayer";
import { formatTime } from "../../hooks/usePlayer";
import CoverImg from "../CoverImg";
import { I } from "../Icon";

interface TransportBarProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onSeekRelative: (d: number) => void;
  onSetVolume: (v: number) => void;
  onSetLoop: (l: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onExpand: () => void;
}

export default function TransportBar({
  state,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onSetVolume,
  onSetLoop,
  onNext,
  onPrev,
  onExpand,
}: TransportBarProps) {
  const { currentWork, isPlaying, currentTime, duration, volume, loop } = state;
  const track = state.tracks[state.currentTrackIndex] ?? null;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    onSeek(Math.max(0, Math.min(duration, t)));
  };

  return (
    <div className="mle-bar1">
      {/* Left: cover + track info */}
      <div className="mle-bar1__now">
        <div className="mle-bar1__cover">
          {currentWork && (
            <CoverImg id={currentWork.id} title={currentWork.title} hasCover={!!currentWork.coverImage} size={46} radius={6} />
          )}
        </div>
        <div className="mle-bar1__meta">
          <span className="mle-bar1__track">{track?.title ?? "—"}</span>
          <span className="mle-bar1__work">{currentWork?.title ?? ""}</span>
        </div>
        <button className="mle-bar1__fav" title="お気に入り">
          <I.heart size={13} />
        </button>
      </div>

      {/* Center: transport buttons */}
      <div className="mle-bar1__transport">
        <button className="mle-bar1__tbtn" title="前へ" onClick={onPrev}>
          <I.prev size={15} />
        </button>
        <button className="mle-bar1__play" title={isPlaying ? "一時停止" : "再生"} onClick={onTogglePlay}>
          {isPlaying ? <I.pause size={14} /> : <I.play size={14} />}
        </button>
        <button className="mle-bar1__tbtn" title="次へ" onClick={onNext}>
          <I.next size={15} />
        </button>
      </div>

      {/* Scrub bar */}
      <div className="mle-bar1__scrub">
        <span className="mle-bar1__time is-now">{formatTime(currentTime)}</span>
        <div className="mle-bar1__track-w" onClick={handleScrubClick} title="シーク">
          <div className="mle-bar1__fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="mle-bar1__time">{formatTime(duration)}</span>
      </div>

      {/* Right: loop / volume / stack / expand */}
      <div className="mle-bar1__right">
        <button
          className={`mle-bar1__iconbtn ${loop ? "is-on" : ""}`}
          title="ループ"
          onClick={() => onSetLoop(!loop)}
        >
          <I.loopOne size={15} />
        </button>

        <div className="mle-bar1__vol">
          <I.volume size={14} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => onSetVolume(Number(e.target.value))}
            style={{
              flex: 1,
              height: 3,
              accentColor: "var(--ink-2)",
              cursor: "pointer",
              outline: "none",
            }}
            title={`音量 ${volume}%`}
          />
        </div>

        <div className="mle-bar1__divider" />

        <button
          className="mle-bar1__stack is-disabled"
          title="重ねて再生（将来実装）"
          disabled
        >
          <span className="ic"><I.add size={13} /></span>
          重ねて再生
        </button>

        <button className="mle-bar1__iconbtn" title="±10秒戻る" onClick={() => onSeekRelative(-10)}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>-10</span>
        </button>
        <button className="mle-bar1__iconbtn" title="±10秒進む" onClick={() => onSeekRelative(10)}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700 }}>+10</span>
        </button>

        <button className="mle-bar1__iconbtn" title="全画面プレイヤー" onClick={onExpand}>
          <I.fs size={14} />
        </button>
      </div>
    </div>
  );
}
