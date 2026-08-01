// 画面下張り付きバーのシークストリップ leaf。currentTime/duration を自前で購読し、親を再レンダリングさせない。
// 経過/総時間のテキストは表示しない（バーの縦幅を圧迫するため撤去。TASK参照:
// 詳しい時間はポップアップ展開で確認する）。ホバー時のツールチップでシーク先の時間だけ出す。

import { usePlaybackProgress } from "../model/usePlaybackProgress";
import { useSeekDrag } from "./useSeekDrag";
import { formatTime } from "../../../shared/lib/format";

interface BarSeekStripProps {
  onSeek: (t: number) => void;
}

export default function BarSeekStrip({ onSeek }: BarSeekStripProps) {
  const { currentTime, duration, pct } = usePlaybackProgress();
  const seek = useSeekDrag({ duration, currentTime, onSeek });

  return (
    <div
      ref={seek.trackRef}
      {...seek.sliderProps}
      className={`mle-bar1__seek ${seek.dragging ? "is-dragging" : ""}`}
      onPointerDown={seek.onPointerDown}
      onPointerMove={seek.onPointerMove}
      onPointerUp={seek.onPointerUp}
      onPointerLeave={seek.onPointerLeave}
    >
      <div className="mle-bar1__seek-track">
        <div className="mle-bar1__seek-fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      {seek.hoverRatio !== null && duration !== null && duration > 0 && (
        <div className="mle-bar1__seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
          {formatTime(seek.hoverTime ?? 0)}
        </div>
      )}
    </div>
  );
}
