// 没入モードのマウスアクティブ時だけ現れる最小トランスポート（試験導入）。
// シーク行とは独立した層で、自分専用のアイドル判定を持つ。削除するときは
// このファイルと NowPlayingImmersive 側の1行の呼び出しを消すだけでよい。

import { I } from "../../../shared/ui/Icon";
import { cn } from "../../../shared/lib/cn";
import { useImmersiveIdle } from "../model/useImmersiveIdle";

interface NowPlayingImmersiveMiniControlsProps {
  isPlaying: boolean;
  volume: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSetVolume: (v: number) => void;
}

const GHOST_BTN =
  "grid h-9 w-9 place-items-center rounded-full cursor-pointer text-white/90 drop-shadow-[0_1px_5px_rgba(0,0,0,0.65)] hover:text-white";

export default function NowPlayingImmersiveMiniControls({
  isPlaying,
  volume,
  onTogglePlay,
  onNext,
  onPrev,
  onSetVolume,
}: NowPlayingImmersiveMiniControlsProps) {
  const idle = useImmersiveIdle(true);

  return (
    <div
      className={cn("mle-nowplaying__immersive-minicontrols", idle && "is-idle")}
      aria-hidden={idle}
    >
      <div className="mle-nowplaying__immersive-minicontrols-group">
        <button
          type="button"
          aria-label="前のトラック"
          title="前のトラック"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className={GHOST_BTN}
        >
          <I.prev size={15} />
        </button>
        <button
          type="button"
          aria-label={isPlaying ? "一時停止" : "再生"}
          title={isPlaying ? "一時停止" : "再生"}
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
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className={GHOST_BTN}
        >
          <I.next size={15} />
        </button>
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
