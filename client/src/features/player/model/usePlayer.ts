// player feature の React フック。
// audioEngine（低レベル Audio 操作）と Jotai atoms（state）を橋渡しする。
//
// 高頻度更新（currentTime / duration）は atoms から直接 subscribe せず useSetAtom で書くだけ。
// → leaf UI だけが playerCurrentTimeAtom を subscribe する。
//
// core state は usePlayerState / leaf コンポーネントでのみ購読する。
// ランタイム（エンジン・コマンド処理）は usePlayerRuntime を <PlayerRuntime /> 内でだけ呼ぶ。

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import type { Work } from "../../../entities/work/model";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { useMediaSession } from "./useMediaSession";
import { toAudioAbsoluteTime, getTrackDurationSec } from "./trackTime";
import { playerCoreAtom, playerCurrentTimeAtom, playerDurationAtom } from "./atoms";
import { usePlayerRuntimeContext } from "./PlayerRuntimeProvider";
import { useAudioEngineLifecycle } from "./useAudioEngineLifecycle";
import { useResumePersistenceController } from "./useResumePersistence";
import { formatTime, formatDuration, formatFileSize } from "../../../shared/lib/format";
import { isPlayerCoreStateEqual, toPlayerCoreState } from "./playerController";
import { usePlayerActions } from "./usePlayerActions";

export { formatTime, formatDuration, formatFileSize };

export function usePlayerRuntime() {
  const queryClient = useQueryClient();
  const { controller, pendingResumeRef, runtimeRefs, capabilitiesRegistry } =
    usePlayerRuntimeContext();
  const [coreState, setCoreState] = useAtom(playerCoreAtom);
  const setCurrentTime = useSetAtom(playerCurrentTimeAtom);
  const setDuration = useSetAtom(playerDurationAtom);
  const lastCoreStateRef = useRef(coreState);

  useLayoutEffect(() => {
    runtimeRefs.coreState.current = coreState;
  }, [runtimeRefs.coreState, coreState]);

  useEffect(
    () =>
      controller.subscribeState((state) => {
        const nextCoreState = toPlayerCoreState(state);
        if (!isPlayerCoreStateEqual(lastCoreStateRef.current, nextCoreState)) {
          lastCoreStateRef.current = nextCoreState;
          setCoreState(nextCoreState);
        }
        setCurrentTime(state.positionSec);
        setDuration(state.durationSec);
      }),
    [controller, setCoreState, setCurrentTime, setDuration],
  );

  const { consumePendingResume, enqueueResumeSave, saveCurrentResume, loadResume } =
    useResumePersistenceController({
      refs: runtimeRefs,
      pendingResumeRef,
    });

  const resetResumeCache = useCallback(
    (workId: string, playlistId: string, trackId: string) => {
      queryClient.setQueryData<Work>(WORK_QUERY_KEYS.detail(workId), (cachedWork) =>
        cachedWork ? { ...cachedWork, resume: { playlistId, trackId, offsetSec: 0 } } : cachedWork,
      );
    },
    [queryClient],
  );

  const { getCurrentPlaybackContext } = useAudioEngineLifecycle({
    coreState,
    refs: runtimeRefs,
    controller,
    consumePendingResume,
  });

  useLayoutEffect(() => {
    return capabilitiesRegistry.register({
      loadResume,
      getCurrentPlaybackContext,
    });
  }, [capabilitiesRegistry, loadResume, getCurrentPlaybackContext]);

  useEffect(() => {
    return controller.subscribeCommands((command) => {
      const engine = runtimeRefs.engine.current;
      switch (command.type) {
        case "playAudio":
          engine?.play();
          break;
        case "pauseAudio":
          engine?.pause();
          break;
        case "seekAudio": {
          const loaded = runtimeRefs.loadedTrack.current;
          if (!engine || !loaded) break;
          const duration = getTrackDurationSec(
            loaded.track,
            runtimeRefs.filesModeFileDurationSec.current,
          );
          engine.seek(toAudioAbsoluteTime(command.positionSec, loaded.track, duration));
          setCurrentTime(command.positionSec);
          runtimeRefs.updateMediaSessionPosition.current(command.positionSec);
          break;
        }
        case "setAudioVolume":
          engine?.setVolume(command.volume);
          break;
        case "setAudioPlaybackRate":
          engine?.setPlaybackRate(command.playbackRate);
          break;
        case "setAudioChannelSwap":
          engine?.setChannelSwap(command.enabled);
          break;
        case "persistResume":
          saveCurrentResume();
          break;
        case "workCompleted": {
          const firstTrack = command.item.tracks[0];
          if (command.item.playlistId === null || !firstTrack) break;
          enqueueResumeSave(command.item.work.id, {
            playlistId: command.item.playlistId,
            trackId: firstTrack.id,
            offsetSec: 0,
          });
          resetResumeCache(command.item.work.id, command.item.playlistId, firstTrack.id);
          break;
        }
        case "loadTrack":
        case "playbackQueueEnded":
          break;
      }
    });
  }, [
    controller,
    enqueueResumeSave,
    resetResumeCache,
    runtimeRefs,
    saveCurrentResume,
    setCurrentTime,
  ]);

  useEffect(() => {
    if (controller.getState().status !== "playing") return;
    const intervalId = setInterval(() => controller.dispatch({ type: "persistTick" }), 5000);
    return () => clearInterval(intervalId);
  }, [controller, coreState.isPlaying, coreState.currentTrackIndex]);

  const getMediaSessionPosition = useCallback(() => {
    const context = getCurrentPlaybackContext();
    if (!context) return null;
    return {
      duration: context.trackDuration,
      position: context.currentTime,
      playbackRate: runtimeRefs.coreState.current.playbackRate,
    };
  }, [getCurrentPlaybackContext, runtimeRefs.coreState]);

  const actions = usePlayerActions();
  const updateMediaSessionPosition = useMediaSession({
    currentWork: coreState.currentWork,
    currentTrack: coreState.tracks[coreState.currentTrackIndex] ?? null,
    currentTrackIndex: coreState.currentTrackIndex,
    trackCount: coreState.tracks.length,
    isPlaying: coreState.isPlaying,
    playbackRate: coreState.playbackRate,
    getPosition: getMediaSessionPosition,
    onPlay: actions.resume,
    onPause: actions.pause,
    onPreviousTrack: actions.prevTrack,
    onNextTrack: actions.nextTrack,
    onSeek: actions.seek,
    onSeekRelative: actions.seekRelative,
  });
  useLayoutEffect(() => {
    runtimeRefs.updateMediaSessionPosition.current = updateMediaSessionPosition;
  }, [runtimeRefs.updateMediaSessionPosition, updateMediaSessionPosition]);
}
