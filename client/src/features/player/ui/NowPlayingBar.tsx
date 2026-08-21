// 再生中タブの下部固定バー。シーク行は没入モード（TASK-363）でも同じ実装を
// 再利用する想定の永続スロットとして、トランスポート/AB行とは独立した
// position: fixed の帯に置く（トランスポート/AB行の表示有無でシーク行の
// 位置・寸法が変わらないようにするため）。帯の背景（装飾）もシーク行本体とは
// 別レイヤーに分離する。

import type { PlayerState } from "../model/usePlayerState";
import NowPlayingScrub from "./NowPlayingScrub";
import PlayerTransportControls from "./PlayerTransportControls";
import ABRepeatBar from "./ABRepeatBar";

interface NowPlayingBarProps {
  state: PlayerState;
  onSeek: (t: number) => void;
  onSetABPointAt: (point: "a" | "b", time: number) => void;
  onTogglePlay: () => void;
  onSeekRelative: (d: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onSetLoop: (l: boolean) => void;
  onSetChannelSwap: (enabled: boolean) => void;
  onSetVolume: (v: number) => void;
  onSetABPoint: (point: "a" | "b") => void;
  onClearABRepeat: () => void;
}

export default function NowPlayingBar({
  state,
  onSeek,
  onSetABPointAt,
  onTogglePlay,
  onSeekRelative,
  onNext,
  onPrev,
  onSetLoop,
  onSetChannelSwap,
  onSetVolume,
  onSetABPoint,
  onClearABRepeat,
}: NowPlayingBarProps) {
  return (
    <>
      <div className="mle-nowplaying__bg" aria-hidden />
      <div className="mle-nowplaying__seek">
        <NowPlayingScrub
          onSeek={onSeek}
          abRepeat={state.abRepeat}
          onSetABPointAt={onSetABPointAt}
        />
      </div>
      <div className="mle-nowplaying__controls">
        <PlayerTransportControls
          isPlaying={state.isPlaying}
          volume={state.volume}
          loop={state.loop}
          channelSwap={state.channelSwap}
          onTogglePlay={onTogglePlay}
          onSeekRelative={onSeekRelative}
          onNext={onNext}
          onPrev={onPrev}
          onSetLoop={onSetLoop}
          onSetChannelSwap={onSetChannelSwap}
          onSetVolume={onSetVolume}
        />
        <ABRepeatBar
          abRepeat={state.abRepeat}
          onSetABPoint={onSetABPoint}
          onClearABRepeat={onClearABRepeat}
        />
      </div>
    </>
  );
}
