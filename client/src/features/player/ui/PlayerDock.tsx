import { useAtom, useAtomValue } from "jotai";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useCallback, useState } from "react";
import { type MotionVariant, useMotionVariants } from "../../../shared/ui/useMotionVariants";
import { playerIsActiveAtom, playerUiModeAtom } from "../../../entities/player/model/atoms";
import { appModeAtom } from "../../../shared/model/appModeAtoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState, type PlayerState } from "../model/usePlayerState";
import { usePopupDrag } from "../model/usePopupDrag";
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
  onStop: () => void;
}

function DockBar({ variant, switching, ...barProps }: DockBarProps) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      className="mle-bar1"
      data-ui-switching={switching || undefined}
      inert={!isPresent}
      {...variant}
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
  onStop: () => void;
}

function DockPopup({ variant, switching, ...popupProps }: DockPopupProps) {
  const isPresent = useIsPresent();
  const drag = usePopupDrag();
  return (
    <motion.div
      ref={drag.popupRef}
      className="mle-popup"
      data-ui-switching={switching || undefined}
      inert={!isPresent}
      drag
      dragListener={false}
      dragControls={drag.dragControls}
      dragConstraints={drag.dragConstraints}
      dragElastic={0}
      dragMomentum={false}
      style={{ x: drag.x, y: drag.y }}
      onPointerDown={drag.onPointerDown}
      onDoubleClick={drag.onDoubleClick}
      onDragEnd={drag.onDragEnd}
      {...variant}
    >
      <PopupContent {...popupProps} />
    </motion.div>
  );
}

interface PlayerDockProps {
  onShowPlayingWork: (workId: string) => void;
}

export default function PlayerDock({ onShowPlayingWork }: PlayerDockProps) {
  const state = usePlayerState();
  const actions = usePlayerActions();
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const isNowPlaying = useAtomValue(appModeAtom) === "nowPlaying";
  const [uiMode, setUiMode] = useAtom(playerUiModeAtom);
  const [switchingUiMode, setSwitchingUiMode] = useState(false);
  const { dockBarSlide, dockBarSwitch, dockPopupScale } = useMotionVariants();

  const handleShowPlayingWork = useCallback(() => {
    const workId = state.currentWork?.id;
    if (!workId) return;
    onShowPlayingWork(workId);
  }, [onShowPlayingWork, state.currentWork]);

  const switchUiMode = (nextMode: "bar" | "popup") => {
    setSwitchingUiMode(true);
    setUiMode(nextMode);
  };

  const clearSwitchingUiMode = useCallback(() => {
    setSwitchingUiMode(false);
  }, []);

  // 再生中タブでは自前の下部固定バーを持つため、PlayerDock（バー/ポップアップ）は
  // 描画しない。playerUiModeAtom（bar/popup）の保存値はここでは変更せず、
  // 他モードへ戻れば保存値どおりに復元される。
  const showBar = isPlaying && uiMode === "bar" && !isNowPlaying;
  const showPopup = isPlaying && uiMode === "popup" && !isNowPlaying;
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
            onStop={actions.stop}
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
            onStop={actions.stop}
          />
        )}
      </AnimatePresence>
    </>
  );
}
