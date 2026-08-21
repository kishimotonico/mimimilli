import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";

interface PlayerTransportControlsProps {
  isPlaying: boolean;
  volume: number;
  loop: boolean;
  channelSwap: boolean;
  onTogglePlay: () => void;
  onSeekRelative: (d: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onSetLoop: (l: boolean) => void;
  onSetChannelSwap: (enabled: boolean) => void;
  onSetVolume: (v: number) => void;
}

// 円形のトランスポートボタン（±10秒 / prev / next / ループ / L⇄R入替）共通スタイル。
// IconButton のサイズ対（26/30/38px）に収まらない再生中タブ専用の 40px 円のため、
// ここでは素の button + Tailwind クラスで組む。
const ROUND_BTN = "grid h-[40px] w-[40px] place-items-center rounded-full cursor-pointer";

export default function PlayerTransportControls({
  isPlaying,
  volume,
  loop,
  channelSwap,
  onTogglePlay,
  onSeekRelative,
  onNext,
  onPrev,
  onSetLoop,
  onSetChannelSwap,
  onSetVolume,
}: PlayerTransportControlsProps) {
  return (
    <div className="flex items-center gap-3.5 pt-2">
      <button
        aria-label="10秒戻る"
        title="10秒戻る"
        onClick={() => onSeekRelative(-10)}
        className={cn(ROUND_BTN, "text-ink-1")}
      >
        <span className="font-mono text-[11px] font-bold">−10</span>
      </button>
      <button
        aria-label="前のトラック"
        title="前のトラック"
        onClick={onPrev}
        className={cn(ROUND_BTN, "text-ink-1")}
      >
        <I.prev size={16} />
      </button>
      <button
        aria-label={isPlaying ? "一時停止" : "再生"}
        title={isPlaying ? "一時停止" : "再生"}
        onClick={onTogglePlay}
        className="grid h-[56px] w-[56px] cursor-pointer place-items-center rounded-full bg-ink-0 text-paper-1"
      >
        {isPlaying ? <I.pause size={18} /> : <I.play size={18} />}
      </button>
      <button
        aria-label="次のトラック"
        title="次のトラック"
        onClick={onNext}
        className={cn(ROUND_BTN, "text-ink-1")}
      >
        <I.next size={16} />
      </button>
      <button
        aria-label="10秒進む"
        title="10秒進む"
        onClick={() => onSeekRelative(10)}
        className={cn(ROUND_BTN, "text-ink-1")}
      >
        <span className="font-mono text-[11px] font-bold">+10</span>
      </button>
      <button
        aria-label="ループ"
        title="ループ"
        aria-pressed={loop}
        onClick={() => onSetLoop(!loop)}
        className={cn(ROUND_BTN, loop ? "bg-acc-soft text-acc" : "text-ink-1")}
      >
        <I.loopOne size={16} />
      </button>
      <button
        aria-label="左右チャンネル入替"
        title="左右チャンネル入替"
        aria-pressed={channelSwap}
        onClick={() => onSetChannelSwap(!channelSwap)}
        className={cn(ROUND_BTN, channelSwap ? "bg-acc-soft text-acc" : "text-ink-1")}
      >
        <I.swapLR size={16} />
      </button>

      <div className="ml-auto flex items-center gap-2">
        <I.volume size={13} className="text-ink-3" />
        <input
          type="range"
          aria-label="音量"
          title={`音量 ${volume}%`}
          min={0}
          max={100}
          value={volume}
          onChange={(e) => onSetVolume(Number(e.target.value))}
          className="w-20 cursor-pointer accent-[var(--ink-2)]"
        />
        <span className="w-[3ch] text-right font-mono text-[11px] tabular-nums text-ink-3">
          {volume}
        </span>
      </div>
    </div>
  );
}
