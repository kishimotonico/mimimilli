import { useEffect } from "react";
import { useAtomValue } from "jotai";
import type { PlayerState } from "../model/usePlayer";
import { playerCurrentTimeAtom, playerDurationAtom } from "../model/atoms";
import { useSeekDrag } from "./useSeekDrag";
import { formatTime } from "../../../shared/lib/format";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";

interface FullScreenPlayerProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onSeekRelative: (d: number) => void;
  onSetVolume: (v: number) => void;
  onSetLoop: (l: boolean) => void;
  onNext: () => void;
  onPrev: () => void;
  onSelectTrack: (i: number) => void;
  onClose: () => void;
}

export default function FullScreenPlayer({
  state,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onSetVolume,
  onSetLoop,
  onNext,
  onPrev,
  onSelectTrack,
  onClose,
}: FullScreenPlayerProps) {
  // currentTime / duration は高頻度 atom から直接読む（App.tsx を re-render させない）
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  const { currentWork, isPlaying, volume, loop, tracks, currentTrackIndex } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const seek = useSeekDrag({ duration, onSeek });

  // Esc to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  if (!currentWork) return null;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "var(--paper-0)",
        display: "grid",
        gridTemplateColumns: "1fr 340px",
        overflow: "hidden",
      }}
    >
      {/* Main: cover + controls */}
      <div style={{ display: "flex", flexDirection: "column", padding: "24px 36px 32px", minHeight: 0 }}>
        {/* Top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button
            style={{ display: "inline-flex", alignItems: "center", gap: 5, height: 28, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line)", fontSize: 11, fontFamily: "var(--font-sans)", background: "var(--paper-1)", color: "var(--ink-1)", cursor: "pointer" }}
            onClick={onClose}
          >
            <I.chevD size={11} style={{ transform: "rotate(90deg)" }} /> 縮小
          </button>
          <div style={{ flex: 1 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
            {currentWork.title}
          </span>
        </div>

        {/* Stage: cover + metadata */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", gap: 48, alignItems: "center", minHeight: 0 }}>
          <div style={{ width: 320, height: 320, borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow-cover), 0 30px 60px -16px oklch(20% 0.020 70 / 0.25)" }}>
            <CoverImg id={currentWork.id} title={currentWork.title} hasCover={!!currentWork.coverImage} size={320} radius={10} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, letterSpacing: "0.16em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 600 }}>
              {currentWork.title}
            </div>
            <h1 style={{ fontFamily: "var(--font-jp)", fontSize: 38, fontWeight: 600, lineHeight: 1.15, color: "var(--ink-0)", letterSpacing: "-0.01em", margin: 0, textWrap: "balance" }}>
              {track?.title ?? "—"}
            </h1>

            {/* Scrub */}
            <div style={{ marginTop: 14 }}>
              <div
                ref={seek.trackRef}
                className={`mle-fullscreen__seek ${seek.dragging ? "is-dragging" : ""}`}
                style={{ height: 18, display: "flex", alignItems: "center", position: "relative", cursor: "pointer" }}
                onPointerDown={seek.onPointerDown}
                onPointerMove={seek.onPointerMove}
                onPointerUp={seek.onPointerUp}
                onPointerLeave={seek.onPointerLeave}
              >
                <div style={{ width: "100%", height: 4, background: "var(--paper-3)", borderRadius: 2, position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${Math.min(100, pct)}%`, background: "var(--ink-0)", borderRadius: 2 }} />
                </div>
                {seek.hoverRatio !== null && duration > 0 && (
                  <div className="mle-seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
                    {formatTime(seek.hoverTime ?? 0)}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink-2)" }}>
                <span style={{ color: "var(--ink-0)" }}>{formatTime(currentTime)}</span>
                <div style={{ flex: 1 }} />
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 8 }}>
              {[
                { label: "−10", action: () => onSeekRelative(-10), mono: true },
              ].map((btn, i) => (
                <button key={i} onClick={btn.action}
                  style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--ink-1)", cursor: "pointer", border: "none", background: "none" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>{btn.label}</span>
                </button>
              ))}
              <button onClick={onPrev} style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--ink-1)", cursor: "pointer", border: "none", background: "none" }}>
                <I.prev size={16} />
              </button>
              <button onClick={onTogglePlay}
                style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--ink-0)", color: "var(--paper-1)", display: "grid", placeItems: "center", cursor: "pointer", border: "none" }}>
                {isPlaying ? <I.pause size={18} /> : <I.play size={18} />}
              </button>
              <button onClick={onNext} style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--ink-1)", cursor: "pointer", border: "none", background: "none" }}>
                <I.next size={16} />
              </button>
              <button onClick={() => onSeekRelative(10)} style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", color: "var(--ink-1)", cursor: "pointer", border: "none", background: "none" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700 }}>+10</span>
              </button>
              <button onClick={() => onSetLoop(!loop)}
                style={{ width: 40, height: 40, borderRadius: "50%", display: "grid", placeItems: "center", color: loop ? "var(--acc)" : "var(--ink-1)", cursor: "pointer", border: "none", background: loop ? "var(--acc-soft)" : "none" }}>
                <I.loopOne size={16} />
              </button>

              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <I.volume size={13} style={{ color: "var(--ink-3)" }} />
                <input type="range" min={0} max={100} value={volume}
                  onChange={(e) => onSetVolume(Number(e.target.value))}
                  style={{ width: 80, accentColor: "var(--ink-2)", cursor: "pointer" }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: track queue */}
      <div style={{ background: "var(--paper-1)", borderLeft: "1px solid var(--line-soft)", padding: "24px 22px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <b style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--ink-0)", fontWeight: 600, letterSpacing: "-0.005em" }}>トラック</b>
          <small style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)" }}>{tracks.length} 件</small>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {tracks.map((t, i) => (
            <div key={i}
              onClick={() => onSelectTrack(i)}
              style={{
                display: "grid", gridTemplateColumns: "24px 1fr 44px",
                gap: 8, padding: "7px 8px", borderRadius: 4, alignItems: "center", cursor: "pointer",
                background: i === currentTrackIndex ? "var(--acc-soft)" : "transparent",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: i === currentTrackIndex ? "var(--acc)" : "var(--ink-3)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span style={{ color: i === currentTrackIndex ? "var(--acc-ink)" : "var(--ink-1)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: i === currentTrackIndex ? 600 : 400 }}>
                {t.title}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", textAlign: "right" }}>
                {t.end != null && t.start != null ? formatTime(Math.round(t.end - t.start)) : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
