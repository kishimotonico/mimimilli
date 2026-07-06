// 画面下張り付きバーの中身（最小構成）。
// カバー + トラック名/作品名 + 再生/一時停止のみ。シークバーは要素全体の下辺を使う。
// シークバー・再生ボタンを除く領域のクリックでポップアップへ切り替わる。

import { useAtomValue } from "jotai";
import type { PlayerState } from "../model/usePlayer";
import { playerCurrentTimeAtom, playerDurationAtom } from "../model/atoms";
import { useSeekDrag } from "./useSeekDrag";
import { formatPlaybackError } from "./formatPlaybackError";
import { formatTime } from "../../../shared/lib/format";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";

interface BarContentProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onSwitchToPopup: () => void;
}

export default function BarContent({
  state,
  onTogglePlay,
  onSeek,
  onSwitchToPopup,
}: BarContentProps) {
  // currentTime / duration は高頻度 atom から直接読む（App.tsx を re-render させない）
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  const { currentWork, isPlaying, tracks, currentTrackIndex, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formattedError = playbackError ? formatPlaybackError(playbackError) : null;

  const seek = useSeekDrag({ duration, onSeek });

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Wrapper contains the play button; making it a button would nest interactive controls. */}
      <div className="mle-bar1__body" onClick={onSwitchToPopup}>
        <div className="mle-bar1__cover">
          {currentWork && (
            <CoverImg
              id={currentWork.id}
              title={currentWork.title}
              hasCover={!!currentWork.coverImage}
              size={46}
              radius={6}
            />
          )}
        </div>

        <div className="mle-bar1__meta">
          <span className="mle-bar1__track" title={track?.title ?? ""}>
            {track?.title ?? "—"}
          </span>
          {formattedError ? (
            <output className="mle-bar1__error" title={formattedError.details}>
              <I.err size={11} />
              {formattedError.label}
            </output>
          ) : (
            <span className="mle-bar1__work" title={currentWork?.title ?? ""}>
              {currentWork?.title ?? ""}
            </span>
          )}
        </div>

        <button
          className="mle-bar1__play"
          title={isPlaying ? "一時停止" : "再生"}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
        >
          {isPlaying ? <I.pause size={16} /> : <I.play size={16} />}
        </button>

        <span className="mle-bar1__expand" aria-hidden="true">
          <I.chevD size={13} style={{ transform: "rotate(180deg)" }} />
        </span>
      </div>

      <div
        ref={seek.trackRef}
        className={`mle-bar1__seek ${seek.dragging ? "is-dragging" : ""}`}
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerUp}
        onPointerLeave={seek.onPointerLeave}
      >
        <div className="mle-bar1__seek-track">
          <div className="mle-bar1__seek-fill" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        {seek.hoverRatio !== null && duration > 0 && (
          <div className="mle-bar1__seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
            {formatTime(seek.hoverTime ?? 0)}
          </div>
        )}
      </div>
    </>
  );
}
