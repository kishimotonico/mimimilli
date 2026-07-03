// 右下ポップアップの中身。日常操作（音量・トラック移動・ループ・再生速度）を厳選して置く。
// channelSwap / abRepeat 等のニッチ機能は置かない（全画面側の役割）。

import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import type { PlayerState } from "../model/usePlayer";
import { playerCurrentTimeAtom, playerDurationAtom } from "../model/atoms";
import { useSeekDrag } from "./useSeekDrag";
import { formatPlaybackError } from "./formatPlaybackError";
import { formatTime } from "../../../shared/lib/format";
import CoverImg from "../../../entities/work/ui/CoverImg";
import { I } from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";

interface PopupContentProps {
  state: PlayerState;
  onTogglePlay: () => void;
  onSeek: (t: number) => void;
  onSeekRelative: (deltaSec: number) => void;
  onSetVolume: (v: number) => void;
  onToggleMute: () => void;
  onSetLoop: (l: boolean) => void;
  onSetPlaybackRate: (r: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onFold: () => void;
  onExpandFullScreen: () => void;
  onShowPlayingWork: () => void;
}

const RATE_PRESETS = [0.75, 1, 1.25, 1.5, 2];
const RATE_LABELS: Record<number, string> = {
  1: "1.0x", 1.25: "1.25x", 1.5: "1.5x", 2: "2.0x", 0.75: "0.75x",
};

function isRateSelected(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.001;
}

export default function PopupContent({
  state,
  onTogglePlay,
  onSeek,
  onSeekRelative,
  onSetVolume,
  onToggleMute,
  onSetLoop,
  onSetPlaybackRate,
  onNext,
  onPrev,
  onFold,
  onExpandFullScreen,
  onShowPlayingWork,
}: PopupContentProps) {
  // currentTime / duration は高頻度 atom から直接読む（App.tsx を re-render させない）
  const currentTime = useAtomValue(playerCurrentTimeAtom);
  const duration = useAtomValue(playerDurationAtom);
  const { currentWork, isPlaying, tracks, currentTrackIndex, volume, loop, playbackRate, playbackError } = state;
  const track = tracks[currentTrackIndex] ?? null;
  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const formattedError = playbackError ? formatPlaybackError(playbackError) : null;
  const [rateMenuOpen, setRateMenuOpen] = useState(false);
  const rateMenuRef = useRef<HTMLDivElement>(null);

  const seek = useSeekDrag({ duration, onSeek });
  const rateLabel = RATE_LABELS[playbackRate] ?? `${playbackRate.toFixed(2)}x`;

  useEffect(() => {
    if (!rateMenuOpen) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (rateMenuRef.current && !rateMenuRef.current.contains(e.target as Node)) {
        setRateMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRateMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [rateMenuOpen]);

  return (
    <>
      <div className="mle-popup__head">
        <IconButton size="sm" icon={I.chevD} label="バーへ戻る" onClick={onFold} />
        <IconButton size="sm" icon={I.fs} label="全画面プレイヤー" onClick={onExpandFullScreen} />
      </div>

      <div className="mle-popup__cover-wrap">
        <div className="mle-popup__cover">
          {currentWork && (
            <CoverImg id={currentWork.id} title={currentWork.title} hasCover={!!currentWork.coverImage} radius={8} fit="fill" />
          )}
          {/* ±10秒: カバーへのホバー時のみ表示 */}
          {!rateMenuOpen && (
            <>
              <button
                className="mle-popup__skip mle-popup__skip--back"
                title="10秒戻る"
                onClick={() => onSeekRelative(-10)}
              >
                <span>−10</span>
              </button>
              <button
                className="mle-popup__skip mle-popup__skip--fwd"
                title="10秒進む"
                onClick={() => onSeekRelative(10)}
              >
                <span>+10</span>
              </button>
            </>
          )}
          <div className="mle-ratepick" ref={rateMenuRef}>
            {rateMenuOpen && (
              <div className="mle-ratepick__pop" role="menu" aria-label="再生速度">
                {RATE_PRESETS.map((rate) => {
                  const checked = isRateSelected(playbackRate, rate);
                  return (
                    <button
                      key={rate}
                      role="menuitemradio"
                      aria-checked={checked}
                      className={`mle-ratepick__item ${checked ? "is-checked" : ""}`}
                      onClick={() => {
                        onSetPlaybackRate(rate);
                        setRateMenuOpen(false);
                      }}
                    >
                      <span className="check">
                        {checked && <I.check size={10} />}
                      </span>
                      <span className="label">{RATE_LABELS[rate]}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <button
              className={`mle-ratepill is-overlay ${playbackRate !== 1 ? "is-on" : ""}`}
              title="再生速度"
              aria-haspopup="menu"
              aria-expanded={rateMenuOpen}
              onClick={() => setRateMenuOpen((v) => !v)}
            >
              {rateLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="mle-popup__meta">
        <div className="mle-popup__track" title={track?.title ?? ""}>{track?.title ?? "—"}</div>
        {formattedError ? (
          <div className="mle-popup__error" role="status" title={formattedError.details}>
            <I.err size={11} />
            {formattedError.label}
          </div>
        ) : (
          <div className="mle-popup__work" title={currentWork?.title ?? ""}>{currentWork?.title ?? ""}</div>
        )}
      </div>

      <div
        ref={seek.trackRef}
        className="mle-popup__seek"
        onPointerDown={seek.onPointerDown}
        onPointerMove={seek.onPointerMove}
        onPointerUp={seek.onPointerUp}
        onPointerLeave={seek.onPointerLeave}
      >
        <div className="mle-popup__seek-track">
          <div className="mle-popup__seek-fill" style={{ width: `${Math.min(100, pct)}%` }} />
          <div className="mle-popup__seek-thumb" style={{ left: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <div className="mle-popup__time-row">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="mle-popup__controls">
        <button className="mle-popup__tbtn" title="前のトラック" onClick={onPrev}>
          <I.prev size={16} />
        </button>
        <button
          className="mle-popup__play"
          title={isPlaying ? "一時停止" : "再生"}
          onClick={onTogglePlay}
        >
          {isPlaying ? <I.pause size={18} /> : <I.play size={18} />}
        </button>
        <button className="mle-popup__tbtn" title="次のトラック" onClick={onNext}>
          <I.next size={16} />
        </button>
        <button
          className={`mle-popup__tbtn ${loop ? "is-on" : ""}`}
          title="ループ"
          aria-pressed={loop}
          onClick={() => onSetLoop(!loop)}
        >
          <I.loopOne size={15} />
        </button>
      </div>

      <div className="mle-popup__row">
        <IconButton
          size="sm"
          icon={I.volume}
          label={volume === 0 ? "ミュート解除" : "ミュート"}
          onClick={onToggleMute}
          className={volume === 0 ? "text-ink-4" : undefined}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="mle-popup__volrange"
          title={`音量 ${volume}%`}
        />
      </div>

      <div className="mt-[2px] flex justify-center border-t border-line-soft pt-2">
        <IconButton size="sm" icon={I.locate} label="再生中の作品を表示" onClick={onShowPlayingWork} />
      </div>
    </>
  );
}
