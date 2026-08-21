// ポップアップのシークバー + 時刻行 leaf。currentTime/duration を自前で購読し、親を再レンダリングさせない。

import { usePlaybackProgress } from "../model/usePlaybackProgress";
import { useSeekDrag } from "./useSeekDrag";
import { formatTime, formatDuration } from "../../../shared/lib/format";

interface PopupSeekProps {
  onSeek: (t: number) => void;
}

export default function PopupSeek({ onSeek }: PopupSeekProps) {
  const { currentTime, duration, pct } = usePlaybackProgress();
  const seek = useSeekDrag({ duration, currentTime, onSeek });

  return (
    <>
      <div
        ref={seek.trackRef}
        {...seek.sliderProps}
        className="mle-popup__seek"
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerUp}
        onPointerCancel={seek.onPointerCancel}
        onLostPointerCapture={seek.onLostPointerCapture}
        onPointerLeave={seek.onPointerLeave}
      >
        <div className="mle-popup__seek-track">
          <div className="mle-popup__seek-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          <div className="mle-popup__seek-thumb" style={{ left: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <div className="mle-popup__time-row">
        <span>{formatTime(currentTime) ?? "0:00"}</span>
        <span>{duration !== null ? (formatDuration(duration) ?? "--:--") : "--:--"}</span>
      </div>
    </>
  );
}
