// 全画面プレイヤーの scrub（AB区間マーカー付き）+ 時刻行 leaf。
// currentTime/duration を自前で購読し、親（トラックキューを持つ FullScreenPlayer）を再レンダリングさせない。

import { usePlaybackProgress } from "../model/usePlaybackProgress";
import { useSeekDrag } from "./useSeekDrag";
import { formatTime, formatDuration } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";
import type { PlayerState } from "../model/usePlayerState";

interface FullScreenScrubProps {
  onSeek: (t: number) => void;
  abRepeat: PlayerState["abRepeat"];
}

export default function FullScreenScrub({ onSeek, abRepeat }: FullScreenScrubProps) {
  const { currentTime, duration, pct } = usePlaybackProgress();
  const seek = useSeekDrag({ duration, onSeek });
  const abStartPct =
    duration !== null && duration > 0 && abRepeat.a !== null ? (abRepeat.a / duration) * 100 : null;
  const abEndPct =
    duration !== null && duration > 0 && abRepeat.b !== null ? (abRepeat.b / duration) * 100 : null;

  return (
    <div className="mt-3.5">
      <div
        ref={seek.trackRef}
        className={cn(
          "mle-fullscreen__seek relative flex h-[18px] cursor-pointer items-center",
          seek.dragging && "is-dragging",
        )}
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerUp}
        onPointerLeave={seek.onPointerLeave}
      >
        <div className="relative h-1 w-full rounded-[2px] bg-paper-3">
          {abStartPct !== null && (
            <div
              className="absolute bottom-0 top-0 rounded-[2px] bg-acc-soft"
              style={{
                left: `${abStartPct}%`,
                width: `${Math.max(0, (abEndPct ?? 100) - abStartPct)}%`,
              }}
            />
          )}
          <div
            className="absolute bottom-0 left-0 top-0 rounded-[2px] bg-ink-0"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        {seek.hoverRatio !== null && duration !== null && duration > 0 && (
          <div className="mle-seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
            {formatTime(seek.hoverTime ?? 0)}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2.5 pt-1 font-mono text-xs text-ink-2">
        <span className="text-ink-0">{formatTime(currentTime) ?? "0:00"}</span>
        <div className="flex-1" />
        <span>{duration !== null ? (formatDuration(duration) ?? "--:--") : "--:--"}</span>
      </div>
    </div>
  );
}
