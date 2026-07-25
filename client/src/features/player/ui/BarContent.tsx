// 画面下張り付きバーの中身（最小構成）。
// カバー + トラック名/作品名 + 前/再生/次。シークバーは要素全体の下辺を使う。
// シークバー・再生操作を除く領域のクリックでポップアップへ切り替わる。

import { useAtomValue } from "jotai";
import type { PlayerState } from "../model/usePlayer";
import { playerCurrentTimeAtom, playerDurationAtom } from "../model/atoms";
import { useSeekDrag } from "./useSeekDrag";
import { formatPlaybackError } from "./formatPlaybackError";
import { formatTime } from "../../../shared/lib/format";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import { I } from "../../../shared/ui/Icon";

interface BarContentProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onSwitchToPopup: () => void;
}

export default function BarContent({
  state,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSwitchToPopup,
}: BarContentProps) {
  // currentTime / duration は高頻度 atom から直接読む（App.tsx を re-render させない）
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  const { currentWork, isPlaying, tracks, currentTrackIndex, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const pct = duration !== null && duration > 0 ? (currentTime / duration) * 100 : 0;
  const formattedError = playbackError ? formatPlaybackError(playbackError) : null;

  const seek = useSeekDrag({ duration, onSeek });

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Wrapper contains the play button; making it a button would nest interactive controls. */}
      <div
        className="mle-bar1__body"
        onClick={(e) => {
          if (e.target instanceof Element && e.target.closest("button")) return;
          onSwitchToPopup();
        }}
      >
        <div className="mle-bar1__cover">
          {currentWork && (
            <CoverImg
              id={currentWork.id}
              title={currentWork.title}
              cover={currentWork.cover}
              size={46}
              radius={6}
              requestWidth={selectFixedCoverThumbnailWidth(46, window.devicePixelRatio)}
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

        <div className="mle-bar1__controls">
          <button
            className="mle-bar1__track-button"
            aria-label="前のトラック"
            title="前のトラック"
            disabled={currentTrackIndex <= 0}
            onClick={(e) => {
              e.stopPropagation();
              onPrev();
            }}
          >
            <I.prev size={16} />
          </button>
          <button
            className="mle-bar1__play"
            aria-label={isPlaying ? "一時停止" : "再生"}
            title={isPlaying ? "一時停止" : "再生"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay();
            }}
          >
            {isPlaying ? <I.pause size={16} /> : <I.play size={16} />}
          </button>
          <button
            className="mle-bar1__track-button"
            aria-label="次のトラック"
            title="次のトラック"
            disabled={currentTrackIndex >= tracks.length - 1}
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            <I.next size={16} />
          </button>
        </div>

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
        {seek.hoverRatio !== null && duration !== null && duration > 0 && (
          <div className="mle-bar1__seek-tooltip" style={{ left: `${seek.hoverRatio * 100}%` }}>
            {formatTime(seek.hoverTime ?? 0)}
          </div>
        )}
      </div>
    </>
  );
}
