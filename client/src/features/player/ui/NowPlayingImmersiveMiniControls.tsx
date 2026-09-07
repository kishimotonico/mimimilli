// 没入モードのマウスアクティブ時だけ現れる最小トランスポート（試験導入）。
// シーク行とは独立した層。idle判定は NowPlayingImmersive 側のuseImmersiveIdle
// 1箇所に集約されており、ここへは表示用の値だけがpropsで渡ってくる
// （トラック切替では再表示されない）。削除するときは以下を消すだけでよい:
//   - このファイル
//   - NowPlayingImmersive 側の import・JSXでの呼び出し・idle propsの受け渡し
//   - now-playing-immersive.css の .mle-nowplaying__immersive-minicontrols* 3ルール

import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";
import PlaybackRatePicker from "./PlaybackRatePicker";

interface NowPlayingImmersiveMiniControlsProps {
  idle: boolean;
  isPlaying: boolean;
  volume: number;
  playbackRate: number;
  isFirstTrack: boolean;
  isLastTrack: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetVolume: (v: number) => void;
  onSetPlaybackRate: (r: number) => void;
}

const GHOST_BTN =
  "grid h-9 w-9 place-items-center rounded-full cursor-pointer text-white/90 drop-shadow-[0_1px_5px_rgba(0,0,0,0.65)] hover:text-white";

export default function NowPlayingImmersiveMiniControls({
  idle,
  isPlaying,
  volume,
  playbackRate,
  isFirstTrack,
  isLastTrack,
  onTogglePlay,
  onNext,
  onPrev,
  onSetVolume,
  onSetPlaybackRate,
}: NowPlayingImmersiveMiniControlsProps) {
  return (
    <div
      className={cn("mle-nowplaying__immersive-minicontrols", idle && "is-idle")}
      aria-hidden={idle}
      inert={idle}
    >
      <div className="mle-nowplaying__immersive-minicontrols-group">
        <button
          type="button"
          aria-label="前のトラック"
          title="前のトラック"
          disabled={isFirstTrack}
          data-player-control
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className={cn(GHOST_BTN, "disabled:cursor-not-allowed disabled:text-white/30")}
        >
          <I.prev size={15} />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "一時停止" : "再生"}
          title={isPlaying ? "一時停止" : "再生"}
          data-player-control
          onClick={(e) => {
            e.stopPropagation();
            onTogglePlay();
          }}
          className={GHOST_BTN}
        >
          {isPlaying ? <I.pause size={17} /> : <I.play size={17} />}
        </button>
        <button
          type="button"
          aria-label="次のトラック"
          title="次のトラック"
          disabled={isLastTrack}
          data-player-control
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className={cn(GHOST_BTN, "disabled:cursor-not-allowed disabled:text-white/30")}
        >
          <I.next size={15} />
        </button>
      </div>

      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- 没入面全体のトグルクリックへの伝播を遮断するだけのラッパー */}
      <div
        className="mle-nowplaying__immersive-minicontrols-group"
        onClick={(e) => e.stopPropagation()}
      >
        <PlaybackRatePicker
          playbackRate={playbackRate}
          onSetPlaybackRate={onSetPlaybackRate}
          overlay
        />
      </div>

      <div className="mle-nowplaying__immersive-minicontrols-group">
        <I.volume size={13} className="text-white/80 drop-shadow-[0_1px_4px_rgba(0,0,0,0.65)]" />
        <input
          type="range"
          aria-label="音量"
          title={`音量 ${volume}%`}
          min={0}
          max={100}
          value={volume}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="w-20 cursor-pointer accent-white"
        />
      </div>
    </div>
  );
}
