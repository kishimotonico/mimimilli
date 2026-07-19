// player feature の React フック。
// audioEngine（低レベル Audio 操作）と Jotai atoms（state）を橋渡しする。
//
// 高頻度更新（currentTime / duration）は atoms から直接 subscribe せず useSetAtom で書くだけ。
// → App.tsx が player を使っても timeupdate による re-render が起きない。
// → BarContent / PopupContent / FullScreenPlayer だけが playerCurrentTimeAtom を subscribe する。

import { useRef, useCallback, useMemo } from "react";
import { useAtom, useSetAtom } from "jotai";
import { useQueryClient } from "@tanstack/react-query";
import type { Track, WorkSummary, Work } from "../../../entities/work/model";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { useMediaSession } from "./useMediaSession";
import { toAudioAbsoluteTime } from "./trackTime";
import {
  playerCoreAtom,
  playerCurrentTimeAtom,
  playerDurationAtom,
  type PlayerCoreState,
} from "./atoms";
import type { PlayerRuntimeRefs } from "./playerRuntime";
import { useAudioEngineLifecycle } from "./useAudioEngineLifecycle";
import { useResumePersistence, useResumePersistenceController } from "./useResumePersistence";
import { formatTime, formatDuration, formatFileSize } from "../../../shared/lib/format";

// ── 後方互換 re-export ─────────────────────────────────────────
export { formatTime, formatDuration, formatFileSize };
export type { PlayerCoreState };

/**
 * PlayerState: コンポーネントの props として渡す state。
 * currentTime / duration は含まない — BarContent / PopupContent / FullScreenPlayer は
 * playerCurrentTimeAtom / playerDurationAtom から直接読む。
 */
export type PlayerState = PlayerCoreState;

export function usePlayer() {
  const queryClient = useQueryClient();
  const [coreState, setCoreState] = useAtom(playerCoreAtom);
  const setCurrentTime = useSetAtom(playerCurrentTimeAtom); // subscribe しない
  const setDuration = useSetAtom(playerDurationAtom); // subscribe しない

  const coreStateRef = useRef(coreState);
  coreStateRef.current = coreState;
  const loopRef = useRef(coreState.loop);
  loopRef.current = coreState.loop;
  const abRepeatRef = useRef(coreState.abRepeat);
  abRepeatRef.current = coreState.abRepeat;
  const engineRef = useRef<PlayerRuntimeRefs["engine"]["current"]>(null);
  const loadedTrackRef = useRef<PlayerRuntimeRefs["loadedTrack"]["current"]>(null);
  const trackEndedRef = useRef(false);
  const updateMediaSessionPositionRef = useRef<(position?: number) => void>(() => {});

  const runtimeRefs = useMemo<PlayerRuntimeRefs>(
    () => ({
      coreState: coreStateRef,
      loop: loopRef,
      abRepeat: abRepeatRef,
      engine: engineRef,
      loadedTrack: loadedTrackRef,
      trackEnded: trackEndedRef,
      updateMediaSessionPosition: updateMediaSessionPositionRef,
    }),
    [],
  );

  const { pendingResumeRef, consumePendingResume, enqueueResumeSave, saveCurrentResume } =
    useResumePersistenceController({
      refs: runtimeRefs,
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
    setCoreState,
    setCurrentTime,
    setDuration,
    consumePendingResume,
    enqueueResumeSave,
    resetResumeCache,
    saveCurrentResume,
  });
  useResumePersistence({
    coreState,
    refs: runtimeRefs,
    saveCurrentResume,
  });

  // ── アクション ────────────────────────────────────────────

  const startPlayback = useCallback(
    (work: WorkSummary | Work, tracks: Track[], trackIndex: number, playlistId: string | null) => {
      setCoreState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        currentPlaylistId: playlistId,
        isPlaying: true,
        playbackError: null,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState],
  );

  const play = useCallback(
    (
      work: WorkSummary | Work,
      tracks: Track[],
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
      const resume = work.resume;
      const defaultPlaylist =
        work.playlists.find((candidate) => candidate.id === work.defaultPlaylistId) ??
        work.playlists[0];
      const resumePlaylist = resume
        ? work.playlists.find((candidate) => candidate.id === resume.playlistId)
        : undefined;
      const resumeTrackIndex =
        resume && resumePlaylist
          ? resumePlaylist.tracks.findIndex((candidate) => candidate.id === resume.trackId)
          : -1;
      const hasValidResume =
        resume !== null && resumePlaylist !== undefined && resumeTrackIndex >= 0;
      const playlist = hasValidResume ? resumePlaylist : defaultPlaylist;
      if (!playlist || playlist.tracks.length === 0) return;

      const trackIndex = hasValidResume ? resumeTrackIndex : 0;
      pendingResumeRef.current = hasValidResume ? { workId: work.id, ...resume } : null;
      startPlayback(work, playlist.tracks, trackIndex, playlist.id);
    },
    [pendingResumeRef, startPlayback],
  );

  const togglePlay = useCallback(() => {
    if (coreState.isPlaying) {
      engineRef.current?.pause();
    } else {
      engineRef.current?.play();
    }
  }, [coreState.isPlaying]);

  const resume = useCallback(() => {
    engineRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
  }, []);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    saveCurrentResume();
    engine?.pause();
    engine?.seek(0);
    loadedTrackRef.current = null;
    pendingResumeRef.current = null;
    setCoreState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackIndex: -1,
      currentPlaylistId: null,
      currentWork: null,
      tracks: [],
      playbackError: null,
    }));
  }, [pendingResumeRef, saveCurrentResume, setCoreState]);

  const seek = useCallback(
    (time: number) => {
      const context = getCurrentPlaybackContext();
      if (!context) return;
      const position = Math.max(0, Math.min(time, context.trackDuration));
      context.engine.seek(toAudioAbsoluteTime(position, context.track, context.trackDuration));
      updateMediaSessionPositionRef.current(position);
    },
    [getCurrentPlaybackContext],
  );
  const seekRelative = useCallback(
    (delta: number) => {
      const context = getCurrentPlaybackContext();
      if (!context) return;
      const position = Math.max(0, Math.min(context.currentTime + delta, context.trackDuration));
      context.engine.seek(toAudioAbsoluteTime(position, context.track, context.trackDuration));
      updateMediaSessionPositionRef.current(position);
    },
    [getCurrentPlaybackContext],
  );

  const setVolume = useCallback(
    (vol: number) => {
      engineRef.current?.setVolume(vol);
      setCoreState((prev) => ({ ...prev, volume: Math.max(0, Math.min(100, vol)) }));
    },
    [setCoreState],
  );

  // ミュート前の音量を覚えておき、解除時に復元する。
  const lastVolumeRef = useRef(coreState.volume || 75);
  const toggleMute = useCallback(() => {
    setCoreState((prev) => {
      if (prev.volume > 0) {
        lastVolumeRef.current = prev.volume;
        engineRef.current?.setVolume(0);
        return { ...prev, volume: 0 };
      }
      const restored = lastVolumeRef.current || 75;
      engineRef.current?.setVolume(restored);
      return { ...prev, volume: restored };
    });
  }, [setCoreState]);

  const setLoop = useCallback(
    (loop: boolean) => {
      setCoreState((prev) => ({ ...prev, loop }));
    },
    [setCoreState],
  );

  const nextTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex < prev.tracks.length - 1) {
        return {
          ...prev,
          currentTrackIndex: prev.currentTrackIndex + 1,
          abRepeat: { a: null, b: null },
        };
      }
      return prev;
    });
  }, [setCoreState]);

  const prevTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex > 0) {
        return {
          ...prev,
          currentTrackIndex: prev.currentTrackIndex - 1,
          abRepeat: { a: null, b: null },
        };
      }
      return prev;
    });
  }, [setCoreState]);

  const setTrackIndex = useCallback(
    (index: number) => {
      setCoreState((prev) => ({
        ...prev,
        currentTrackIndex: index,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState],
  );

  const setShowFullPlayer = useCallback(
    (show: boolean) => {
      setCoreState((prev) => ({ ...prev, showFullPlayer: show }));
    },
    [setCoreState],
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      engineRef.current?.setPlaybackRate(rate);
      setCoreState((prev) => ({ ...prev, playbackRate: rate }));
    },
    [setCoreState],
  );

  const setChannelSwap = useCallback(
    (enabled: boolean) => {
      engineRef.current?.setChannelSwap(enabled);
      setCoreState((prev) => ({ ...prev, channelSwap: enabled }));
    },
    [setCoreState],
  );

  const setABPoint = useCallback(
    (point: "a" | "b") => {
      const time = getCurrentPlaybackContext()?.currentTime ?? 0;
      setCoreState((prev) => {
        const next = { ...prev.abRepeat, [point]: time };
        // B→A の順で設定して区間が逆転した場合は入れ替えて成立させる
        if (next.a !== null && next.b !== null && next.a > next.b) {
          return { ...prev, abRepeat: { a: next.b, b: next.a } };
        }
        return { ...prev, abRepeat: next };
      });
    },
    [getCurrentPlaybackContext, setCoreState],
  );

  const clearABRepeat = useCallback(() => {
    setCoreState((prev) => ({ ...prev, abRepeat: { a: null, b: null } }));
  }, [setCoreState]);

  const getMediaSessionPosition = useCallback(() => {
    const context = getCurrentPlaybackContext();
    if (!context) return null;
    return {
      duration: context.trackDuration,
      position: context.currentTime,
      playbackRate: coreStateRef.current.playbackRate,
    };
  }, [getCurrentPlaybackContext]);

  const updateMediaSessionPosition = useMediaSession({
    currentWork: coreState.currentWork,
    currentTrack: coreState.tracks[coreState.currentTrackIndex] ?? null,
    currentTrackIndex: coreState.currentTrackIndex,
    trackCount: coreState.tracks.length,
    isPlaying: coreState.isPlaying,
    playbackRate: coreState.playbackRate,
    getPosition: getMediaSessionPosition,
    onPlay: resume,
    onPause: pause,
    onPreviousTrack: prevTrack,
    onNextTrack: nextTrack,
    onSeek: seek,
    onSeekRelative: seekRelative,
  });
  updateMediaSessionPositionRef.current = updateMediaSessionPosition;

  return {
    state: coreState,
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
  };
}
