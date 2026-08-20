import { useLayoutEffect, useRef } from "react";
import type { PlayerState } from "../model/usePlayerState";
import FullScreenScrub from "./FullScreenScrub";
import PlaybackErrorNotice from "./PlaybackErrorNotice";
import PlaybackArtwork from "./PlaybackArtwork";
import PlayerTransportControls from "./PlayerTransportControls";
import ABRepeatBar from "./ABRepeatBar";
import { formatDuration } from "../../../shared/lib/format";
import { selectFixedCoverThumbnailWidth } from "../../../entities/work/ui/coverThumbnailWidth";
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
  onStop: () => void;
  onSetChannelSwap: (enabled: boolean) => void;
  onSetABPoint: (point: "a" | "b") => void;
  onClearABRepeat: () => void;
}

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
  onStop,
  onSetChannelSwap,
  onSetABPoint,
  onClearABRepeat,
}: FullScreenPlayerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const {
    currentWork,
    isFilePlayback,
    isPlaying,
    volume,
    loop,
    tracks,
    currentTrackIndex,
    channelSwap,
    abRepeat,
    playbackError,
  } = state;
  const track = tracks[currentTrackIndex] ?? null;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    dialog.showModal();
    closeButtonRef.current?.focus({ preventScroll: true });

    return () => {
      dialog.close();
      if (previousActiveElement?.isConnected) {
        previousActiveElement.focus({ preventScroll: true });
      }
    };
  }, []);

  if (!currentWork && !isFilePlayback) return null;

  return (
    <dialog
      ref={dialogRef}
      aria-label="全画面プレイヤー"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-0 grid h-screen max-h-none w-screen max-w-none grid-cols-[1fr_340px] overflow-hidden border-0 bg-paper-0 p-0 text-ink-0 backdrop:bg-transparent"
    >
      {/* Main: cover + controls */}
      <div className="flex min-h-0 flex-col px-9 pb-8 pt-6">
        {/* Top bar */}
        <div className="mb-6 flex items-center gap-3">
          <IconButton
            ref={closeButtonRef}
            size="md"
            icon={I.minimize}
            label="縮小"
            onClick={onClose}
          />
          <div className="flex-1" />
          <span className="font-mono text-[11px] text-ink-3">
            {isFilePlayback ? "ファイル" : currentWork!.title}
          </span>
          <IconButton
            size="md"
            icon={I.x}
            label="再生を停止"
            onClick={onStop}
            className="ml-1 hover:text-[var(--r-coral)]"
          />
        </div>

        {/* Stage: cover + metadata */}
        <div className="grid min-h-0 flex-1 grid-cols-[320px_1fr] items-center gap-12">
          <div className="h-[320px] w-[320px] overflow-hidden rounded-[10px] shadow-[var(--shadow-cover),0_30px_60px_-16px_oklch(20%_0.020_70/0.25)]">
            <PlaybackArtwork
              state={state}
              size={320}
              radius={10}
              requestWidth={selectFixedCoverThumbnailWidth(320, window.devicePixelRatio)}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2.5">
            <div className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-3">
              {isFilePlayback ? "ファイル" : currentWork!.title}
            </div>
            <h1 className="m-0 text-balance font-jp text-[38px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink-0">
              {track?.title ?? "—"}
            </h1>

            <PlaybackErrorNotice
              error={playbackError}
              className="inline-flex min-w-0 max-w-full items-center gap-1 font-jp text-[10.5px] text-[var(--r-coral)]"
            />

            {/* Scrub */}
            <FullScreenScrub onSeek={onSeek} abRepeat={abRepeat} />

            {/* Controls */}
            <PlayerTransportControls
              isPlaying={isPlaying}
              volume={volume}
              loop={loop}
              channelSwap={channelSwap}
              onTogglePlay={onTogglePlay}
              onSeekRelative={onSeekRelative}
              onNext={onNext}
              onPrev={onPrev}
              onSetLoop={onSetLoop}
              onSetChannelSwap={onSetChannelSwap}
              onSetVolume={onSetVolume}
            />

            {/* A-Bリピート: A/B点の設定・解除。設定中はシークバー上の範囲表示（上部）で分かる */}
            <ABRepeatBar
              abRepeat={abRepeat}
              onSetABPoint={onSetABPoint}
              onClearABRepeat={onClearABRepeat}
            />
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
              <button
                type="button"
                key={t.id}
                onClick={() => onSelectTrack(i)}
                className={cn(
                  "grid cursor-pointer grid-cols-[24px_1fr_44px] items-center gap-2 rounded px-2 py-[7px]",
                  isCurrent ? "bg-acc-soft" : "bg-transparent",
                )}
              >
                <span
                  className={cn("font-mono text-[10.5px]", isCurrent ? "text-acc" : "text-ink-3")}
                >
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
                  {t.end != null && t.start != null ? (formatDuration(t.end - t.start) ?? "") : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </dialog>
  );
}
