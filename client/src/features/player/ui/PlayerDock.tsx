// 常駐再生UIの外枠。「画面下張り付きバー」⇄「右下ポップアップ」の2層を切り替える。
// - 表示/非表示（isPlaying）: 再生開始時に画面下からスライドイン、停止時にスライドアウト
//   （一時停止中は currentWork が残る限り表示し続ける。× ボタンは置かない）
// - バー/ポップアップの切替: 2つの Presence を並置。退出完了後に入場（enter の transition-delay で wait 感を近似）
// - どちらを使っていたかは playerUiModeAtom（localStorage）で記憶・復元する

import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useState } from "react";
import { cn } from "../../../shared/lib/cn";
import Presence from "../../../shared/ui/Presence";
import {
  selectLibraryWorkAtom,
  setLibraryAxisAtom,
} from "../../library/model/libraryNavigationActions";
import { setAppModeAtom } from "../../navigation/model/navigationAtoms";
import { playerIsActiveAtom, playerUiModeAtom } from "../model/atoms";
import { usePlayerActions } from "../model/usePlayerActions";
import { usePlayerState } from "../model/usePlayerState";
import BarContent from "./BarContent";
import PopupContent from "./PopupContent";

const DOCK_SWITCH_MS = 180;

export default function PlayerDock() {
  const state = usePlayerState();
  const actions = usePlayerActions();
  const isPlaying = useAtomValue(playerIsActiveAtom);
  const [uiMode, setUiMode] = useAtom(playerUiModeAtom);
  const [switchingUiMode, setSwitchingUiMode] = useState(false);
  const setAppMode = useSetAtom(setAppModeAtom);
  const setLibraryAxis = useSetAtom(setLibraryAxisAtom);
  const selectLibraryWork = useSetAtom(selectLibraryWorkAtom);

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

  return (
    <>
      <Presence
        show={isPlaying && uiMode === "bar"}
        variant={switchingUiMode ? "dock-bar-switch" : "dock-bar-slide"}
        skipInitial
        durationMs={switchingUiMode ? DOCK_SWITCH_MS : undefined}
        className={cn(
          "mle-bar1",
          switchingUiMode && uiMode === "bar" && "ml-presence-dock-bar--wait-enter",
        )}
        onExitComplete={clearSwitchingUiMode}
      >
        <BarContent
          state={state}
          onTogglePlay={actions.togglePlay}
          onNext={actions.nextTrack}
          onPrev={actions.prevTrack}
          onSeek={actions.seek}
          onSwitchToPopup={() => switchUiMode("popup")}
          onSetVolume={actions.setVolume}
        />
      </Presence>
      <Presence
        show={isPlaying && uiMode === "popup"}
        variant="dock-popup-scale"
        skipInitial
        durationMs={DOCK_SWITCH_MS}
        className={cn(
          "mle-popup",
          switchingUiMode && uiMode === "popup" && "ml-presence-dock-popup--wait-enter",
        )}
        onExitComplete={clearSwitchingUiMode}
      >
        <PopupContent
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
      </Presence>
    </>
  );
}
