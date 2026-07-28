// player feature の React フック。
// audioEngine（低レベル Audio 操作）と Jotai atoms（state）を橋渡しする。
//
// 高頻度更新（currentTime / duration）は atoms から直接 subscribe せず useSetAtom で書くだけ。
// → leaf UI だけが playerCurrentTimeAtom を subscribe する。
//
// core state は usePlayerState / leaf コンポーネントでのみ購読する。
// ランタイム（エンジン・コマンド処理）は usePlayerRuntime を <PlayerRuntime /> 内でだけ呼ぶ。

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import type { WorkListItem, Work } from "../../../entities/work/model";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { useMediaSession } from "./useMediaSession";
import { toAudioAbsoluteTime, getTrackDurationSec, type PlaybackTrack } from "./trackTime";
import { playerCoreAtom, playerCurrentTimeAtom, playerDurationAtom } from "./atoms";
import { usePlayerRuntimeContext } from "./PlayerRuntimeProvider";
import { useAudioEngineLifecycle } from "./useAudioEngineLifecycle";
import { useResumePersistenceController } from "./useResumePersistence";
import { formatTime, formatDuration, formatFileSize } from "../../../shared/lib/format";
import {
  isPlayerCoreStateEqual,
  toPlayerCoreState,
  type PlaybackItem,
  type PlayerCoreState,
} from "./playerController";

// ── 後方互換 re-export ─────────────────────────────────────────
export { formatTime, formatDuration, formatFileSize };
export type { PlayerCoreState };

/**
 * PlayerState: コンポーネントの props として渡す state。
 * currentTime / duration は含まない — BarContent / PopupContent / FullScreenPlayer は
 * playerCurrentTimeAtom / playerDurationAtom から直接読む。
 */
export type PlayerState = PlayerCoreState;

export function usePlayerState(): PlayerCoreState {
  return useAtomValue(playerCoreAtom);
}

export function usePlayerActions() {
  const {
    controller,
    lastVolumeRef,
    pendingResumeRef,
    runtimeRefs,
    getCurrentPlaybackContextRef,
    loadResumeRef,
  } = usePlayerRuntimeContext();

  const startPlayback = useCallback(
    (
      work: WorkListItem | Work,
      tracks: PlaybackTrack[],
      trackIndex: number,
      playlistId: string | null,
      positionSec?: number,
    ) => {
      const item: PlaybackItem = {
        work,
        playlistId,
        tracks,
        trackIndex,
        completionScope: playlistId === null ? "queue" : "work",
      };
      controller.dispatch({ type: "startRequested", item, positionSec });
    },
    [controller],
  );

  const play = useCallback(
    (
      work: WorkListItem | Work,
      tracks: PlaybackTrack[],
      trackIndex: number = 0,
      playlistId: string | null = null,
    ) => {
      pendingResumeRef.current = null;
      startPlayback(work, tracks, trackIndex, playlistId);
    },
    [pendingResumeRef, startPlayback],
  );

  const playWithResume = useCallback(
    (work: Work) => {
      const loadResume = loadResumeRef.current;
      if (!loadResume) return;
      const resume = loadResume(work);
      if (!resume) return;
      startPlayback(work, resume.tracks, resume.trackIndex, resume.playlistId, resume.positionSec);
    },
    [loadResumeRef, startPlayback],
  );

  const togglePlay = useCallback(() => {
    controller.dispatch({ type: "toggleRequested" });
  }, [controller]);

  const resume = useCallback(() => {
    controller.dispatch({ type: "playRequested" });
  }, [controller]);

  const pause = useCallback(() => {
    controller.dispatch({ type: "pauseRequested" });
  }, [controller]);

  const stop = useCallback(() => {
    pendingResumeRef.current = null;
    controller.dispatch({ type: "stopRequested" });
    runtimeRefs.loadedTrack.current = null;
  }, [controller, pendingResumeRef, runtimeRefs.loadedTrack]);

  const seek = useCallback(
    (time: number) => {
      if (!getCurrentPlaybackContextRef.current()) return;
      controller.dispatch({ type: "seekRequested", positionSec: time });
    },
    [controller, getCurrentPlaybackContextRef],
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const context = getCurrentPlaybackContextRef.current();
      if (!context) return;
      controller.dispatch({ type: "seekRequested", positionSec: context.currentTime + delta });
    },
    [controller, getCurrentPlaybackContextRef],
  );

  const setVolume = useCallback(
    (vol: number) => {
      controller.dispatch({ type: "volumeChanged", volume: vol });
    },
    [controller],
  );

  const toggleMute = useCallback(() => {
    const volume = controller.getState().volume;
    if (volume > 0) {
      lastVolumeRef.current = volume;
      controller.dispatch({ type: "volumeChanged", volume: 0 });
    } else {
      const restored = lastVolumeRef.current || 75;
      controller.dispatch({ type: "volumeChanged", volume: restored });
    }
  }, [controller, lastVolumeRef]);

  const setLoop = useCallback(
    (loop: boolean) => {
      controller.dispatch({ type: "loopChanged", loop });
    },
    [controller],
  );

  const nextTrack = useCallback(() => {
    controller.dispatch({ type: "nextRequested" });
  }, [controller]);

  const prevTrack = useCallback(() => {
    controller.dispatch({ type: "previousRequested" });
  }, [controller]);

  const setTrackIndex = useCallback(
    (index: number) => {
      controller.dispatch({ type: "trackSelected", trackIndex: index });
    },
    [controller],
  );

  const setShowFullPlayer = useCallback(
    (show: boolean) => {
      controller.dispatch({ type: "fullPlayerVisibilityChanged", visible: show });
    },
    [controller],
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      controller.dispatch({ type: "playbackRateChanged", playbackRate: rate });
    },
    [controller],
  );

  const setChannelSwap = useCallback(
    (enabled: boolean) => {
      controller.dispatch({ type: "channelSwapChanged", enabled });
    },
    [controller],
  );

  const setABPoint = useCallback(
    (point: "a" | "b") => {
      const time = getCurrentPlaybackContextRef.current()?.currentTime ?? 0;
      controller.dispatch({ type: "abPointSet", point, positionSec: time });
    },
    [controller, getCurrentPlaybackContextRef],
  );

  const clearABRepeat = useCallback(() => {
    controller.dispatch({ type: "abCleared" });
  }, [controller]);

  return useMemo(
    () => ({
      play,
      playWithResume,
      togglePlay,
      stop,
      seek,
      seekRelative,
      setVolume,
      toggleMute,
      setLoop,
      nextTrack,
      prevTrack,
      setTrackIndex,
      setShowFullPlayer,
      setPlaybackRate,
      setChannelSwap,
      setABPoint,
      clearABRepeat,
      resume,
      pause,
    }),
    [
      play,
      playWithResume,
      togglePlay,
      stop,
      seek,
      seekRelative,
      setVolume,
      toggleMute,
      setLoop,
      nextTrack,
      prevTrack,
      setTrackIndex,
      setShowFullPlayer,
      setPlaybackRate,
      setChannelSwap,
      setABPoint,
      clearABRepeat,
      resume,
      pause,
    ],
  );
}

export function usePlayerRuntime() {
  const queryClient = useQueryClient();
  const { controller, pendingResumeRef, runtimeRefs, getCurrentPlaybackContextRef, loadResumeRef } =
    usePlayerRuntimeContext();
  const [coreState, setCoreState] = useAtom(playerCoreAtom);
  const setCurrentTime = useSetAtom(playerCurrentTimeAtom);
  const setDuration = useSetAtom(playerDurationAtom);
  const lastCoreStateRef = useRef(coreState);

  runtimeRefs.coreState.current = coreState;

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
  loadResumeRef.current = loadResume;

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
  getCurrentPlaybackContextRef.current = getCurrentPlaybackContext;

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
  runtimeRefs.updateMediaSessionPosition.current = updateMediaSessionPosition;
}
