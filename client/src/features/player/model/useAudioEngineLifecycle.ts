import { useCallback, useEffect } from "react";
import { getAudioUrl } from "../../../entities/work/api";
import { saveResumePosition, updateLastPlayed } from "../api";
import { createAudioEngine } from "./audioEngine";
import {
  getTrackDuration,
  getTrackStart,
  hasReachedTrackEnd,
  toAudioAbsoluteTime,
  toTrackRelativeTime,
} from "./trackTime";
import type {
  LoadedTrack,
  PlaybackContext,
  PlayerRuntimeRefs,
  SetCoreState,
} from "./playerRuntime";
import type { PlayerCoreState } from "./atoms";

interface UseAudioEngineLifecycleOptions {
  coreState: PlayerCoreState;
  refs: PlayerRuntimeRefs;
  setCoreState: SetCoreState;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  consumePendingResume: (
    workId: string,
    trackIndex: number,
    track: LoadedTrack["track"],
  ) => number | undefined;
  saveCurrentResume: (absolutePosition?: number, loadedTrack?: LoadedTrack | null) => void;
}

export function useAudioEngineLifecycle({
  coreState,
  refs,
  setCoreState,
  setCurrentTime,
  setDuration,
  consumePendingResume,
  saveCurrentResume,
}: UseAudioEngineLifecycleOptions) {
  const getCurrentPlaybackContext = useCallback(
    (absoluteCurrentTime?: number): PlaybackContext | null => {
      const engine = refs.engine.current;
      const loadedTrack = refs.loadedTrack.current;
      if (!engine || !loadedTrack) return null;

      const trackDuration = getTrackDuration(loadedTrack.track, engine.getDuration());
      const currentTime = toTrackRelativeTime(
        absoluteCurrentTime ?? engine.getCurrentTime(),
        loadedTrack.track,
        trackDuration,
      );
      return { engine, track: loadedTrack.track, trackDuration, currentTime };
    },
    [refs.engine, refs.loadedTrack],
  );

  useEffect(() => {
    const engineRef = refs.engine;

    const finishCurrentTrack = (virtualEnd: boolean) => {
      if (refs.trackEnded.current) return;
      refs.trackEnded.current = true;

      const loadedTrack = refs.loadedTrack.current;
      if (refs.loop.current) {
        const start = loadedTrack ? getTrackStart(loadedTrack.track) : 0;
        engineRef.current?.seek(start);
        refs.updateMediaSessionPosition.current(0);
        engineRef.current?.play();
        refs.trackEnded.current = false;
        return;
      }

      const state = refs.coreState.current;
      const nextTrack = loadedTrack ? state.tracks[loadedTrack.trackIndex + 1] : undefined;
      const continuesSameAsset =
        loadedTrack !== null &&
        state.currentWork?.id === loadedTrack.workId &&
        nextTrack !== undefined &&
        getAudioUrl(loadedTrack.workId, nextTrack.file) === loadedTrack.assetUrl;
      const finishedWork =
        loadedTrack !== null &&
        state.currentWork?.id === loadedTrack.workId &&
        nextTrack === undefined;

      // 区間トラックではファイル自体の再生が続くため、継続できない境界では明示的に止める。
      if (virtualEnd && !continuesSameAsset) engineRef.current?.pause();

      if (loadedTrack) {
        if (finishedWork) {
          saveResumePosition(loadedTrack.workId, 0, 0).catch(() => {});
        } else {
          const absoluteEnd =
            loadedTrack.track.end ??
            engineRef.current?.getDuration() ??
            getTrackStart(loadedTrack.track);
          saveCurrentResume(absoluteEnd, loadedTrack);
        }
      }

      setCoreState((previous) => {
        if (previous.currentTrackIndex < previous.tracks.length - 1) {
          return { ...previous, currentTrackIndex: previous.currentTrackIndex + 1 };
        }
        return { ...previous, isPlaying: false };
      });
    };

    const engine = createAudioEngine(refs.coreState.current.volume, {
      onPlay: () => setCoreState((state) => ({ ...state, isPlaying: true, playbackError: null })),
      onPause: () => setCoreState((state) => ({ ...state, isPlaying: false })),
      onTimeUpdate: (time) => {
        const context = getCurrentPlaybackContext(time);
        if (!context) return;
        const { engine: currentEngine, track, trackDuration, currentTime } = context;
        const reachedTrackEnd = hasReachedTrackEnd(time, track);

        if (!reachedTrackEnd) {
          refs.trackEnded.current = false;
        }

        const abRepeat = refs.abRepeat.current;
        if (
          abRepeat.a !== null &&
          abRepeat.b !== null &&
          abRepeat.a < abRepeat.b &&
          currentTime >= abRepeat.b
        ) {
          currentEngine.seek(toAudioAbsoluteTime(abRepeat.a, track, trackDuration));
          setCurrentTime(abRepeat.a);
          refs.updateMediaSessionPosition.current(abRepeat.a);
          return;
        }
        setCurrentTime(currentTime);

        if (reachedTrackEnd) {
          finishCurrentTrack(true);
        }
      },
      onDurationChange: (duration) => {
        const loadedTrack = refs.loadedTrack.current;
        setDuration(loadedTrack ? getTrackDuration(loadedTrack.track, duration) : duration);
        refs.updateMediaSessionPosition.current();
      },
      onEnded: () => finishCurrentTrack(false),
      onError: (error) => {
        setCoreState((state) => ({ ...state, isPlaying: false, playbackError: error }));
      },
    });
    engineRef.current = engine;

    return () => {
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      engine.destroy();
    };
  }, [
    getCurrentPlaybackContext,
    refs,
    saveCurrentResume,
    setCoreState,
    setCurrentTime,
    setDuration,
  ]);

  // トラック変更時に音源を読み込み、同じ音源ならロードせず区間だけを切り替える。
  useEffect(() => {
    const engine = refs.engine.current;
    if (!engine) return;

    const { currentTrackIndex, tracks, currentWork } = coreState;
    if (currentTrackIndex < 0 || currentTrackIndex >= tracks.length || !currentWork) return;

    const track = tracks[currentTrackIndex];
    const workId = currentWork.id;
    const assetUrl = getAudioUrl(workId, track.file);

    const previousTrack = refs.loadedTrack.current;
    const switchedTrack =
      previousTrack !== null &&
      (previousTrack.workId !== workId || previousTrack.trackIndex !== currentTrackIndex);
    if (switchedTrack) {
      saveCurrentResume(undefined, previousTrack);
    }

    const pendingSeekSec = consumePendingResume(workId, currentTrackIndex, track);
    const reusesLoadedAsset =
      switchedTrack && previousTrack.workId === workId && previousTrack.assetUrl === assetUrl;

    refs.loadedTrack.current = { workId, trackIndex: currentTrackIndex, track, assetUrl };
    refs.trackEnded.current = false;

    if (reusesLoadedAsset) {
      const seekSec = pendingSeekSec ?? getTrackStart(track);
      const trackDuration = getTrackDuration(track, engine.getDuration());
      engine.seek(seekSec);
      const relativeTime = toTrackRelativeTime(seekSec, track, trackDuration);
      setCurrentTime(relativeTime);
      setDuration(trackDuration);
      refs.updateMediaSessionPosition.current(relativeTime);

      if (coreState.isPlaying) {
        engine.play();
      }

      updateLastPlayed(workId).catch(() => {});
      return;
    }

    if (track.start !== undefined || track.end !== undefined) {
      setCurrentTime(0);
      setDuration(track.end === undefined ? 0 : getTrackDuration(track, track.end));
    }

    const cleanup = engine.load(assetUrl, {
      playbackRate: coreState.playbackRate,
      startSec: pendingSeekSec === undefined && track.start !== undefined ? track.start : undefined,
      pendingSeekSec,
    });

    updateLastPlayed(workId).catch(() => {});
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreState.currentTrackIndex, coreState.tracks, coreState.currentWork]);

  return { getCurrentPlaybackContext };
}
