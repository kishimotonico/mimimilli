// 常駐再生UIの外枠。「画面下張り付きバー」⇄「右下ポップアップ」の2層を切り替える。
// - 表示/非表示（isPlaying）: 再生開始時に画面下からスライドイン、停止時にスライドアウト
//   （一時停止中は currentWork が残る限り表示し続ける。× ボタンは置かない）
// - バー/ポップアップの切替: 2つの AnimatePresence を並置。退出完了後に入場（enter側だけ180ms遅延）
// - どちらを使っていたかは playerUiModeAtom（localStorage）で記憶・復元する

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useCallback, useState } from "react";
import { selectLibraryWorkAtom } from "../../library/model/libraryNavigationActions";
import { useLibraryNavigation } from "../../library/model/useLibraryNavigation";
import { setAppModeAtom } from "../../navigation/model/navigationAtoms";
import { type MotionVariant, useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { playerIsActiveAtom, playerUiModeAtom } from "../model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState, type PlayerState } from "../model/usePlayerState";
import BarContent from "./BarContent";
import PopupContent from "./PopupContent";

interface DockBarProps {
  variant: MotionVariant;
  switching: boolean;
  state: PlayerState;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (t: number) => void;
  onSwitchToPopup: () => void;
  onSetVolume: (v: number) => void;
}

function DockBar({ variant, switching, ...barProps }: DockBarProps) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      className="mle-bar1"
      data-ui-switching={switching || undefined}
      initial={variant.initial}
      animate={variant.animate}
      exit={variant.exit}
      inert={!isPresent}
    >
      <BarContent {...barProps} />
    </motion.div>
  );
}

interface DockPopupProps {
  variant: MotionVariant;
  switching: boolean;
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

function DockPopup({ variant, switching, ...popupProps }: DockPopupProps) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      className="mle-popup"
      data-ui-switching={switching || undefined}
      initial={variant.initial}
      animate={variant.animate}
      exit={variant.exit}
      inert={!isPresent}
    >
      <PopupContent {...popupProps} />
    </motion.div>
  );
}

export default function PlayerDock() {
  const state = usePlayerState();
  const actions = usePlayerActions();
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const [uiMode, setUiMode] = useAtom(playerUiModeAtom);
  const [switchingUiMode, setSwitchingUiMode] = useState(false);
  const setAppMode = useSetAtom(setAppModeAtom);
  const { setAxis: setLibraryAxis } = useLibraryNavigation();
  const selectLibraryWork = useSetAtom(selectLibraryWorkAtom);
  const { dockBarSlide, dockBarSwitch, dockPopupScale } = useMotionVariants();

  const handleShowPlayingWork = useCallback(() => {
    const workId = state.currentWork?.id;
    if (!workId) return;
    setAppMode("library");
    setLibraryAxis("all");
    selectLibraryWork(workId);
  }, [selectLibraryWork, setAppMode, setLibraryAxis, state.currentWork]);

  const switchUiMode = (nextMode: "bar" | "popup") => {
    setSwitchingUiMode(true);
    setUiMode(nextMode);
  };

  const clearSwitchingUiMode = useCallback(() => {
    setSwitchingUiMode(false);
  }, []);

  const showBar = isPlaying && uiMode === "bar";
  const showPopup = isPlaying && uiMode === "popup";
  const barVariant = switchingUiMode
    ? dockBarSwitch({ waitEnter: uiMode === "bar" })
    : dockBarSlide();
  const popupVariant = dockPopupScale({ waitEnter: switchingUiMode && uiMode === "popup" });

  return (
    <>
      <AnimatePresence initial={false} onExitComplete={clearSwitchingUiMode}>
        {showBar && (
          <DockBar
            key="bar"
            variant={barVariant}
            switching={switchingUiMode}
            state={state}
            onTogglePlay={actions.togglePlay}
            onNext={actions.nextTrack}
            onPrev={actions.prevTrack}
            onSeek={actions.seek}
            onSwitchToPopup={() => switchUiMode("popup")}
            onSetVolume={actions.setVolume}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false} onExitComplete={clearSwitchingUiMode}>
        {showPopup && (
          <DockPopup
            key="popup"
            variant={popupVariant}
            switching={switchingUiMode}
            state={state}
            onTogglePlay={actions.togglePlay}
            onSeek={actions.seek}
            onSeekRelative={actions.seekRelative}
            onSetVolume={actions.setVolume}
            onToggleMute={actions.toggleMute}
            onSetLoop={actions.setLoop}
            onSetPlaybackRate={actions.setPlaybackRate}
            onNext={actions.nextTrack}
            onPrev={actions.prevTrack}
            onFold={() => switchUiMode("bar")}
            onExpandFullScreen={() => actions.setShowFullPlayer(true)}
            onShowPlayingWork={handleShowPlayingWork}
          />
        )}
      </AnimatePresence>
    </>
  );
}
