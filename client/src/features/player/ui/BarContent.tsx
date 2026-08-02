// 画面下張り付きバーの中身（最小構成）。
// カバー + トラック名/作品名 + 前/再生/次。シークバーは要素全体の下辺を使う。
// シークバー・再生操作を除く領域のクリックでポップアップへ切り替わる。

import type { PlayerState } from "../model/usePlayerState";
import BarSeekStrip from "./BarSeekStrip";
import BarVolumePopover from "./BarVolumePopover";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import PlaybackArtwork from "./PlaybackArtwork";
import { I } from "../../../shared/ui/Icon";

interface BarContentProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onSwitchToPopup: () => void;
  onSetVolume: (volume: number) => void;
}

export default function BarContent({
  state,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onSwitchToPopup,
  onSetVolume,
}: BarContentProps) {
  const {
    currentWork,
    isFilePlayback,
    isPlaying,
    tracks,
    currentTrackIndex,
    playbackError,
    volume,
  } = state;
  const track = tracks[currentTrackIndex] ?? null;

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
          {(currentWork || isFilePlayback) && (
            <PlaybackArtwork state={state} size={52} radius={6} />
          )}
        </div>

        <div className="mle-bar1__meta">
          <span className="mle-bar1__track" title={track?.title ?? ""}>
            {track?.title ?? "—"}
          </span>
          {playbackError ? (
            <PlaybackErrorNotice error={playbackError} className="mle-bar1__error" />
          ) : (
            <span
              className="mle-bar1__work"
              title={isFilePlayback ? "" : (currentWork?.title ?? "")}
            >
              {isFilePlayback ? "ファイル" : (currentWork?.title ?? "")}
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
          <BarVolumePopover volume={volume} onSetVolume={onSetVolume} />
        </div>

        <button
          type="button"
          className="mle-bar1__expand"
          aria-label="バーを展開"
          title="バーを展開"
          onClick={(e) => {
            e.stopPropagation();
            onSwitchToPopup();
          }}
        >
          <I.chevD size={13} style={{ transform: "rotate(180deg)" }} />
        </button>
      </div>

      <BarSeekStrip onSeek={onSeek} />
    </>
  );
}
