import { useEffect } from "react";
import { useAtomValue } from "jotai";
import type { PlayerState } from "../model/usePlayer";
import { playerCurrentTimeAtom, playerDurationAtom } from "../model/atoms";
import { useSeekDrag } from "./useSeekDrag";
import { formatTime } from "../../../shared/lib/format";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import { cn } from "../../../shared/lib/cn";

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

// 円形のトランスポートボタン（±10秒 / prev / next / ループ）共通スタイル。
// IconButton のサイズ対（26/30/38px）に収まらない全画面専用の 40px 円のため、
// ここでは素の button + Tailwind クラスで組む。
const ROUND_BTN = "grid h-[40px] w-[40px] place-items-center rounded-full cursor-pointer";

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
    <div className="fixed inset-0 z-50 grid grid-cols-[1fr_340px] overflow-hidden bg-paper-0">
      {/* Main: cover + controls */}
      <div className="flex min-h-0 flex-col px-9 pb-8 pt-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center gap-3">
          <IconButton size="md" icon={I.minimize} label="縮小" onClick={onClose} />
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-ink-3">{currentWork.title}</span>
        </div>

        {/* Stage: cover + metadata */}
        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] items-center gap-12">
          <div className="h-[320px] w-[320px] overflow-hidden rounded-[10px] shadow-[var(--shadow-cover),0_30px_60px_-16px_oklch(20%_0.020_70/0.25)]">
            <CoverImg id={currentWork.id} title={currentWork.title} hasCover={!!currentWork.coverImage} size={320} radius={10} />
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {currentWork.title}
            </div>
            <h1 className="m-0 text-balance font-jp text-[38px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink-0">
              {track?.title ?? "—"}
            </h1>

            {/* Scrub */}
            <div className="mt-3.5">
              <div
                ref={seek.trackRef}
                className={cn("mle-fullscreen__seek relative flex h-[18px] cursor-pointer items-center", seek.dragging && "is-dragging")}
                onPointerDown={seek.onPointerDown}
                onPointerMove={seek.onPointerMove}
                onPointerUp={seek.onPointerUp}
                onPointerLeave={seek.onPointerLeave}
              >
                <div className="relative h-1 w-full rounded-[2px] bg-paper-3">
                  <div className="absolute bottom-0 left-0 top-0 rounded-[2px] bg-ink-0" style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                {seek.hoverRatio !== null && duration > 0 && (
                  <div className="mle-seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
                    {formatTime(seek.hoverTime ?? 0)}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2.5 pt-1 font-mono text-xs text-ink-2">
                <span className="text-ink-0">{formatTime(currentTime)}</span>
                <div className="flex-1" />
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3.5 pt-2">
              <button onClick={() => onSeekRelative(-10)} className={cn(ROUND_BTN, "text-ink-1")}>
                <span className="font-mono text-[11px] font-bold">−10</span>
              </button>
              <button onClick={onPrev} className={cn(ROUND_BTN, "text-ink-1")}>
                <I.prev size={16} />
              </button>
              <button
                onClick={onTogglePlay}
                className="grid h-[56px] w-[56px] cursor-pointer place-items-center rounded-full bg-ink-0 text-paper-1"
              >
                {isPlaying ? <I.pause size={18} /> : <I.play size={18} />}
              </button>
              <button onClick={onNext} className={cn(ROUND_BTN, "text-ink-1")}>
                <I.next size={16} />
              </button>
              <button onClick={() => onSeekRelative(10)} className={cn(ROUND_BTN, "text-ink-1")}>
                <span className="font-mono text-[11px] font-bold">+10</span>
              </button>
              <button
                onClick={() => onSetLoop(!loop)}
                className={cn(ROUND_BTN, loop ? "bg-acc-soft text-acc" : "text-ink-1")}
              >
                <I.loopOne size={16} />
              </button>

              <div className="ml-auto flex items-center gap-2">
                <I.volume size={13} className="text-ink-3" />
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={volume}
                  onChange={(e) => onSetVolume(Number(e.target.value))}
                  className="w-20 cursor-pointer accent-[var(--ink-2)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: track queue */}
      <div className="flex flex-col gap-3 overflow-hidden border-l border-line-soft bg-paper-1 px-[22px] py-6">
        <div className="flex items-baseline gap-2">
          <b className="font-sans text-sm font-semibold tracking-[-0.005em] text-ink-0">トラック</b>
          <small className="font-mono text-[10.5px] text-ink-3">{tracks.length} 件</small>
        </div>
        <div className="flex flex-col gap-px overflow-y-auto">
          {tracks.map((t, i) => {
            const isCurrent = i === currentTrackIndex;
            return (
              <div
                key={i}
                onClick={() => onSelectTrack(i)}
                className={cn(
                  "grid cursor-pointer grid-cols-[24px_1fr_44px] items-center gap-2 rounded px-2 py-[7px]",
                  isCurrent ? "bg-acc-soft" : "bg-transparent",
                )}
              >
                <span className={cn("font-mono text-[10.5px]", isCurrent ? "text-acc" : "text-ink-3")}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px]",
                    isCurrent ? "font-semibold text-acc-ink" : "font-normal text-ink-1",
                  )}
                >
                  {t.title}
                </span>
                <span className="text-right font-mono text-[10.5px] text-ink-3">
                  {t.end != null && t.start != null ? formatTime(Math.round(t.end - t.start)) : ""}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
