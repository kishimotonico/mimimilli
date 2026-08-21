// 再生中タブの scrub（AB区間ハンドル付き）+ 時刻行 leaf。
// currentTime/duration を自前で購読し、親（NowPlayingView）を再レンダリングさせない
// （docs/HANDOFF.md の高頻度atom購読設計）。

import { usePlaybackProgress } from "../model/usePlaybackProgress";
import { useSeekDrag } from "./useSeekDrag";
import { useABHandleDrag } from "./useABHandleDrag";
import { formatTime, formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import type { PlayerState } from "../model/usePlayerState";

interface NowPlayingScrubProps {
  mode: "normal" | "immersive";
  onSeek: (t: number) => void;
  abRepeat: PlayerState["abRepeat"];
  onSetABPointAt: (point: "a" | "b", time: number) => void;
}

interface ABHandleProps {
  point: "a" | "b";
  pct: number;
  trackRef: React.RefObject<HTMLDivElement | null>;
  duration: number | null;
  time: number;
  onSetABPointAt: (point: "a" | "b", time: number) => void;
}

// 角括弧（［ / ］）スタイルのハンドル。border の3辺だけを描画してブラケット形状を作る。
// A は左辺+上下辺（左からの開き括弧）、B は右辺+上下辺（右への閉じ括弧）。
function ABHandle({ point, pct, trackRef, duration, time, onSetABPointAt }: ABHandleProps) {
  const drag = useABHandleDrag({
    trackRef,
    duration,
    onSet: (t) => onSetABPointAt(point, t),
  });
  const isA = point === "a";

  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- ABハンドルはトラック上のドラッグ可能なマーカーで、input要素の意味論とは合わない
      role="slider"
      tabIndex={0}
      aria-label={isA ? "AB区間の開始位置" : "AB区間の終了位置"}
      aria-valuenow={time}
      aria-valuemin={0}
      aria-valuemax={duration ?? 0}
      aria-valuetext={formatTime(time) ?? "0:00"}
      aria-orientation="horizontal"
      className="absolute top-1/2 z-10 grid h-6 w-6 cursor-ew-resize touch-none place-items-center"
      style={{ left: `${pct}%`, transform: "translate(-50%, -50%)" }}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onLostPointerCapture={drag.onLostPointerCapture}
      onKeyDown={(e) => {
        if (!duration) return;
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        e.stopPropagation();
        if (e.key === "ArrowLeft") onSetABPointAt(point, Math.max(0, time - 1));
        else onSetABPointAt(point, Math.min(duration, time + 1));
      }}
    >
      <div
        className={cn(
          "h-4 w-[9px] border-2 border-acc",
          isA ? "rounded-l-[3px] border-r-0" : "rounded-r-[3px] border-l-0",
          drag.dragging && "border-[var(--r-coral)]",
        )}
      />
    </div>
  );
}

export default function NowPlayingScrub({
  mode,
  onSeek,
  abRepeat,
  onSetABPointAt,
}: NowPlayingScrubProps) {
  const { currentTime, duration, pct } = usePlaybackProgress();
  const seek = useSeekDrag({ duration, currentTime, onSeek });
  const hasDuration = duration !== null && duration > 0;
  const abStartPct = hasDuration && abRepeat.a !== null ? (abRepeat.a / duration) * 100 : null;
  const abEndPct = hasDuration && abRepeat.b !== null ? (abRepeat.b / duration) * 100 : null;
  const isImmersive = mode === "immersive";

  return (
    <div className="mt-4">
      <div
        ref={seek.trackRef}
        {...seek.sliderProps}
        className={cn(
          "relative flex h-6 cursor-pointer items-center",
          seek.dragging && "is-dragging",
        )}
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerUp}
        onPointerCancel={seek.onPointerCancel}
        onLostPointerCapture={seek.onLostPointerCapture}
        onPointerLeave={seek.onPointerLeave}
      >
        <div
          className={cn(
            "relative h-[5px] w-full rounded-[3px]",
            isImmersive ? "bg-paper-0/30" : "bg-paper-3",
          )}
        >
          {abStartPct !== null && (
            <div
              className="absolute bottom-0 top-0 rounded-[3px] bg-acc-soft"
              style={{
                left: `${abStartPct}%`,
                width: `${Math.max(0, (abEndPct ?? 100) - abStartPct)}%`,
              }}
            />
          )}
          <div
            className={cn(
              "absolute bottom-0 left-0 top-0 rounded-[3px]",
              isImmersive ? "bg-acc" : "bg-ink-0",
            )}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {seek.hoverRatio !== null && duration !== null && duration > 0 && (
          <div className="mle-seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
            {formatTime(seek.hoverTime ?? 0)}
          </div>
        )}
        {abStartPct !== null && (
          <ABHandle
            point="a"
            pct={abStartPct}
            trackRef={seek.trackRef}
            duration={duration}
            time={abRepeat.a!}
            onSetABPointAt={onSetABPointAt}
          />
        )}
        {abEndPct !== null && (
          <ABHandle
            point="b"
            pct={abEndPct}
            trackRef={seek.trackRef}
            duration={duration}
            time={abRepeat.b!}
            onSetABPointAt={onSetABPointAt}
          />
        )}
      </div>
      <div
        className={cn(
          "flex items-center gap-2.5 pt-1.5 font-mono text-xs",
          isImmersive ? "text-paper-0" : "text-ink-2",
        )}
        style={isImmersive ? { textShadow: "0 1px 6px oklch(10% 0.02 70 / 0.6)" } : undefined}
      >
        <span className={isImmersive ? undefined : "text-ink-0"}>
          {formatTime(currentTime) ?? "0:00"}
        </span>
        <div className="flex-1" />
        <span>{duration !== null ? (formatDuration(duration) ?? "--:--") : "--:--"}</span>
      </div>
    </div>
  );
}
