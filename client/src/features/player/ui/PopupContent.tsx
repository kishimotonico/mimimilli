// 右下ポップアップの中身。日常操作（音量・トラック移動・ループ・再生速度）を厳選して置く。
// channelSwap / abRepeat 等のニッチ機能は置かない（再生中タブ側の役割）。

import { useState } from "react";
import type { PlayerState } from "../model/usePlayerState";
import PopupSeek from "./PopupSeek";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import PlaybackArtwork from "./PlaybackArtwork";
import PlaybackRatePicker from "./PlaybackRatePicker";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";

interface PopupContentProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onSeekRelative: (deltaSec: number) => void;
  onSetVolume: (v: number) => void;
  onSetLoop: (l: boolean) => void;
  onSetPlaybackRate: (r: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onFold: () => void;
  onOpenNowPlaying: () => void;
  onShowPlayingWork: () => void;
  onStop: () => void;
  onRetryError: () => void;
  onDismissError: () => void;
}

export default function PopupContent({
  state,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onSetVolume,
  onSetLoop,
  onSetPlaybackRate,
  onNext,
  onPrev,
  onFold,
  onOpenNowPlaying,
  onShowPlayingWork,
  onStop,
  onRetryError,
  onDismissError,
}: PopupContentProps) {
  const {
    currentWork,
    isFilePlayback,
    isPlaying,
    tracks,
    currentTrackIndex,
    volume,
    loop,
    playbackRate,
    playbackError,
  } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const isFirstTrack = currentTrackIndex <= 0;
  const isLastTrack = currentTrackIndex >= tracks.length - 1;
  // 速度メニューが開いている間はカバー右側の±10秒ボタンと縦位置が重なるため隠す
  const [rateMenuOpen, setRateMenuOpen] = useState(false);

  return (
    <>
      <div className="mle-popup__head">
        {!isFilePlayback && (
          <IconButton
            size="sm"
            icon={I.locate}
            label="再生中の作品を表示"
            onClick={onShowPlayingWork}
          />
        )}
        {isFilePlayback && <div />}
        <div className="mle-popup__head-actions">
          <IconButton size="sm" icon={I.chevD} label="バーへ戻る" onClick={onFold} />
          <IconButton size="sm" icon={I.fs} label="再生中タブを表示" onClick={onOpenNowPlaying} />
          <IconButton
            size="sm"
            icon={I.x}
            label="再生を停止"
            onClick={onStop}
            className="ml-1 hover:text-[var(--r-coral)]"
          />
        </div>
      </div>

      <div className="mle-popup__cover-wrap">
        <div className="mle-popup__cover">
          {(currentWork || isFilePlayback) && (
            <PlaybackArtwork
              state={state}
              size={308}
              radius={8}
              fit="fill"
              requestWidth={selectFixedCoverThumbnailWidth(308, window.devicePixelRatio)}
            />
          )}
          {/* ±10秒: 常時薄く表示し、ホバーで強調する。速度メニューが開くと縦位置が重なるため隠す */}
          {!rateMenuOpen && (
            <>
              <button
                className="mle-popup__skip mle-popup__skip--back"
                title="10秒戻る"
                data-player-control
                onClick={() => onSeekRelative(-10)}
              >
                <span>−10</span>
              </button>
              <button
                className="mle-popup__skip mle-popup__skip--fwd"
                title="10秒進む"
                data-player-control
                onClick={() => onSeekRelative(10)}
              >
                <span>+10</span>
              </button>
            </>
          )}
          <PlaybackRatePicker
            playbackRate={playbackRate}
            onSetPlaybackRate={onSetPlaybackRate}
            onOpenChange={setRateMenuOpen}
            overlay
          />
        </div>
      </div>

      <div className="mle-popup__meta">
        <div className="mle-popup__track" title={track?.title ?? ""}>
          {track?.title ?? "—"}
        </div>
        {playbackError ? (
          <PlaybackErrorNotice
            error={playbackError}
            className="mle-popup__error"
            onRetry={onRetryError}
            onDismiss={onDismissError}
          />
        ) : (
          <div className="mle-popup__work" title={isFilePlayback ? "" : (currentWork?.title ?? "")}>
            {isFilePlayback ? "ファイル" : (currentWork?.title ?? "")}
          </div>
        )}
      </div>

      <PopupSeek onSeek={onSeek} />

      <div className="mle-popup__controls">
        <button
          className="mle-popup__tbtn"
          title="前のトラック"
          disabled={isFirstTrack}
          data-player-control
          onClick={onPrev}
        >
          <I.prev size={16} />
        </button>
        <button
          className="mle-popup__play"
          title={isPlaying ? "一時停止" : "再生"}
          data-player-control
          onClick={onTogglePlay}
        >
          {isPlaying ? <I.pause size={18} /> : <I.play size={18} />}
        </button>
        <button
          className="mle-popup__tbtn"
          title="次のトラック"
          disabled={isLastTrack}
          data-player-control
          onClick={onNext}
        >
          <I.next size={16} />
        </button>
        <button
          className={`mle-popup__tbtn ${loop ? "is-on" : ""}`}
          title="ループ"
          aria-pressed={loop}
          data-player-control
          onClick={() => onSetLoop(!loop)}
        >
          <I.loopOne size={15} />
        </button>
      </div>

      <div className="mle-popup__row">
        <I.volume size={14} className={volume === 0 ? "text-ink-4" : "text-ink-2"} aria-hidden />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="mle-popup__volrange"
          title={`音量 ${volume}%`}
        />
        <span className="mle-popup__volval">{volume}</span>
      </div>
    </>
  );
}
