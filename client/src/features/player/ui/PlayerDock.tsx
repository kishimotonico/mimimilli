// 常駐再生UIの外枠。「画面下張り付きバー」⇄「右下ポップアップ」の2層を切り替える。
// - 表示/非表示（isPlaying）: 再生開始時に画面下からスライドイン、停止時にスライドアウト
//   （一時停止中は currentWork が残る限り表示し続ける。× ボタンは置かない）
// - バー/ポップアップの切替: それぞれ別要素として AnimatePresence の enter/exit で
//   切り替える（シンプルな交換。形の異なる要素間で layout モーフィングすると
//   カバー画像が歪む・再生ボタンが飛来して見えるなど不自然になるため採用しない）
// - どちらを使っていたかは playerUiModeAtom（localStorage）で記憶・復元する

import { useAtom } from "jotai";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { playerUiModeAtom } from "../model/atoms";
import type { PlayerState } from "../model/usePlayer";
import BarContent from "./BarContent";
import PopupContent from "./PopupContent";

interface PlayerDockProps {
  isPlaying: boolean;
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
  onExpandFullScreen: () => void;
  onShowPlayingWork: () => void;
}

const DOCK_SLIDE_TRANSITION = { type: "spring" as const, stiffness: 420, damping: 32, mass: 0.9 };
const DOCK_SWITCH_TRANSITION = { type: "tween" as const, duration: 0.18, ease: "easeOut" as const };

export default function PlayerDock({
  isPlaying,
  state,
  onExpandFullScreen,
  ...actions
}: PlayerDockProps) {
  const [uiMode, setUiMode] = useAtom(playerUiModeAtom);
  const [switchingUiMode, setSwitchingUiMode] = useState(false);

  const switchUiMode = (nextMode: "bar" | "popup") => {
    setSwitchingUiMode(true);
    setUiMode(nextMode);
  };

  return (
    <AnimatePresence initial={false} onExitComplete={() => setSwitchingUiMode(false)}>
      {isPlaying && uiMode === "bar" && (
        <motion.div
          key="bar"
          className="mle-bar1"
          initial={{ y: "100%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={switchingUiMode ? DOCK_SWITCH_TRANSITION : DOCK_SLIDE_TRANSITION}
        >
          <BarContent
            state={state}
            onTogglePlay={actions.onTogglePlay}
            onSeek={actions.onSeek}
            onSwitchToPopup={() => switchUiMode("popup")}
          />
        </motion.div>
      )}
      {isPlaying && uiMode === "popup" && (
        <motion.div
          key="popup"
          className="mle-popup"
          style={{ transformOrigin: "bottom right" }}
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={DOCK_SWITCH_TRANSITION}
        >
          <PopupContent
            state={state}
            onTogglePlay={actions.onTogglePlay}
            onSeek={actions.onSeek}
            onSeekRelative={actions.onSeekRelative}
            onSetVolume={actions.onSetVolume}
            onToggleMute={actions.onToggleMute}
            onSetLoop={actions.onSetLoop}
            onSetPlaybackRate={actions.onSetPlaybackRate}
            onNext={actions.onNext}
            onPrev={actions.onPrev}
            onFold={() => switchUiMode("bar")}
            onExpandFullScreen={onExpandFullScreen}
            onShowPlayingWork={actions.onShowPlayingWork}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
