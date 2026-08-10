import { useCallback, useMemo } from "react";
import type { WorkListItem, Work } from "../../../entities/work/model";
import { usePlayerRuntimeContext } from "./PlayerRuntimeProvider";
import type { PlaybackTrack } from "./trackTime";
import type { PlaybackItem } from "./playerController";

export function usePlayerActions() {
  const { controller, lastVolumeRef, pendingResumeRef, requireCapabilities } =
    usePlayerRuntimeContext();

  const startPlayback = useCallback(
    (
      work: WorkListItem | Work,
      tracks: PlaybackTrack[],
      trackIndex: number,
      playlistId: string | null,
      positionSec?: number,
    ) => {
      const item: PlaybackItem = {
        source: { kind: "work", work },
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

  const playFile = useCallback(
    (tracks: PlaybackTrack[], trackIndex: number = 0) => {
      pendingResumeRef.current = null;
      const item: PlaybackItem = {
        source: { kind: "file" },
        playlistId: null,
        tracks,
        trackIndex,
        completionScope: "queue",
      };
      controller.dispatch({ type: "startRequested", item });
    },
    [controller, pendingResumeRef],
  );

  const playWithResume = useCallback(
    (work: Work) => {
      const { loadResume } = requireCapabilities();
      const resume = loadResume(work);
      if (!resume) return;
      startPlayback(work, resume.tracks, resume.trackIndex, resume.playlistId, resume.positionSec);
    },
    [requireCapabilities, startPlayback],
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
  }, [controller, pendingResumeRef]);

  const seek = useCallback(
    (time: number) => {
      const { getCurrentPlaybackContext } = requireCapabilities();
      if (!getCurrentPlaybackContext()) return;
      controller.dispatch({ type: "seekRequested", positionSec: time });
    },
    [controller, requireCapabilities],
  );

  const seekRelative = useCallback(
    (delta: number) => {
      const { getCurrentPlaybackContext } = requireCapabilities();
      const context = getCurrentPlaybackContext();
      if (!context) return;
      controller.dispatch({ type: "seekRequested", positionSec: context.currentTime + delta });
    },
    [controller, requireCapabilities],
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
      const { getCurrentPlaybackContext } = requireCapabilities();
      const time = getCurrentPlaybackContext()?.currentTime ?? 0;
      controller.dispatch({ type: "abPointSet", point, positionSec: time });
    },
    [controller, requireCapabilities],
  );

  const clearABRepeat = useCallback(() => {
    controller.dispatch({ type: "abCleared" });
  }, [controller]);

  return useMemo(
    () => ({
      play,
      playFile,
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
      playFile,
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
