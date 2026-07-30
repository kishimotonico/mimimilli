import { useCallback, useEffect } from "react";
import { getAudioUrl } from "../../../entities/work/api";
import { updateLastPlayed } from "../api";
import { createAudioEngine } from "./audioEngine";
import {
  getTrackDurationSec,
  getTrackStart,
  hasReachedTrackEnd,
  isResolvedTrack,
  toTrackRelativeTime,
} from "./trackTime";
import type { LoadedTrack, PlaybackContext, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlaybackItem, PlayerController } from "./playerController";

interface UseAudioEngineLifecycleOptions {
  refs: PlayerRuntimeRefs;
  controller: PlayerController;
  consumePendingResume: (
    workId: string,
    playlistId: string | null,
    track: LoadedTrack["track"],
  ) => number | undefined;
}

export function useAudioEngineLifecycle({
  refs,
  controller,
  consumePendingResume,
}: UseAudioEngineLifecycleOptions) {
  const getCurrentPlaybackContext = useCallback(
    (absoluteCurrentTime?: number): PlaybackContext | null => {
      const engine = refs.engine.current;
      const loadedTrack = refs.loadedTrack.current;
      if (!engine || !loadedTrack) return null;

      const trackDuration = getTrackDurationSec(
        loadedTrack.track,
        refs.filesModeFileDurationSec.current,
      );
      const currentTime = toTrackRelativeTime(
        absoluteCurrentTime ?? engine.getCurrentTime(),
        loadedTrack.track,
        trackDuration,
      );
      return { engine, track: loadedTrack.track, trackDuration, currentTime };
    },
    [refs.engine, refs.loadedTrack, refs.filesModeFileDurationSec],
  );

  useEffect(() => {
    const engineRef = refs.engine;
    const loadCleanupRef = refs.loadCleanup;

    const finishCurrentTrack = (virtualEnd: boolean) => {
      if (refs.trackEnded.current) return;
      refs.trackEnded.current = true;

      const loadedTrack = refs.loadedTrack.current;
      const state = refs.coreState.current;
      const nextTrack = loadedTrack ? state.tracks[loadedTrack.trackIndex + 1] : undefined;
      const continuesSameAsset =
        loadedTrack !== null &&
        state.currentWork?.id === loadedTrack.workId &&
        nextTrack !== undefined &&
        getAudioUrl(loadedTrack.workId, nextTrack.file) === loadedTrack.assetUrl;
      // 区間トラックではファイル自体の再生が続くため、継続できない境界では明示的に止める。
      if (virtualEnd && !continuesSameAsset) engineRef.current?.pause();
      controller.dispatch({ type: "audioEnded" });
      if (controller.getState().loop) refs.trackEnded.current = false;
    };

    const engine = createAudioEngine(refs.coreState.current.volume, {
      onPlay: () => {
        if (refs.trackEnded.current) {
          const loadedTrack = refs.loadedTrack.current;
          if (loadedTrack) {
            engineRef.current?.seek(getTrackStart(loadedTrack.track));
            controller.dispatch({ type: "audioTimeUpdated", positionSec: 0 });
            refs.updateMediaSessionPosition.current(0);
          }
          refs.trackEnded.current = false;
        }
        controller.dispatch({ type: "audioPlaying" });
      },
      onPause: () => {
        if (!refs.trackEnded.current) controller.dispatch({ type: "audioPaused" });
      },
      onTimeUpdate: (time) => {
        const context = getCurrentPlaybackContext(time);
        if (!context) return;
        const { track, currentTime } = context;
        const reachedTrackEnd = hasReachedTrackEnd(time, track);

        if (!reachedTrackEnd) {
          refs.trackEnded.current = false;
        }

        const commands = controller.dispatch({
          type: "audioTimeUpdated",
          positionSec: currentTime,
        });

        // B点が区間終端と一致する場合も、Aへのシークをトラック終了より優先する。
        if (commands.some((command) => command.type === "seekAudio")) return;

        if (reachedTrackEnd) {
          finishCurrentTrack(true);
        }
      },
      // durationchange は Files モードの即席トラック専用経路。登録トラックは DTO の durationSec が
      // 権威であり、ここでは上書きしない。
      onDurationChange: (duration) => {
        const loadedTrack = refs.loadedTrack.current;
        if (!loadedTrack || isResolvedTrack(loadedTrack.track)) return;
        refs.filesModeFileDurationSec.current = duration;
        controller.dispatch({
          type: "audioDurationChanged",
          durationSec: getTrackDurationSec(loadedTrack.track, duration),
        });
        refs.updateMediaSessionPosition.current();
      },
      onEnded: () => finishCurrentTrack(false),
      onError: (error) => {
        controller.dispatch({ type: "audioFailed", error });
      },
    });
    engineRef.current = engine;

    return () => {
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      loadCleanupRef.current?.();
      loadCleanupRef.current = null;
      engine.destroy();
    };
  }, [getCurrentPlaybackContext, controller, refs]);

  // loadTrack コマンドを実ロード/シークへ接続する。再生するかどうかは controller が決めた
  // autoplay に従う（無条件 playAudio() のような命令的副作用で状態機械を上書きしない）。
  const loadTrack = useCallback(
    (item: PlaybackItem, autoplay: boolean) => {
      const engine = refs.engine.current;
      if (!engine) return;

      const { trackIndex: currentTrackIndex, playlistId: currentPlaylistId, tracks } = item;
      const currentWork = item.work;
      if (currentTrackIndex < 0 || currentTrackIndex >= tracks.length) return;

      const track = tracks[currentTrackIndex];
      if (!track) return;

      const workId = currentWork.id;
      const assetUrl = getAudioUrl(workId, track.file);

      const previousTrack = refs.loadedTrack.current;
      const switchedTrack =
        previousTrack !== null &&
        (previousTrack.workId !== workId ||
          previousTrack.playlistId !== currentPlaylistId ||
          previousTrack.track.id !== track.id);
      const pendingSeekSec = consumePendingResume(workId, currentPlaylistId, track);
      const reusesLoadedAsset =
        switchedTrack && previousTrack.workId === workId && previousTrack.assetUrl === assetUrl;

      refs.loadedTrack.current = {
        workId,
        playlistId: currentPlaylistId,
        trackIndex: currentTrackIndex,
        track,
        assetUrl,
      };
      refs.trackEnded.current = false;
      if (!reusesLoadedAsset) {
        refs.filesModeFileDurationSec.current = null;
      } else if (!isResolvedTrack(track) && refs.filesModeFileDurationSec.current === null) {
        // 登録トラック→同一音源のFilesモード即席トラックへの切り替え。再ロードもdurationchangeも
        // 発生しないため、既にロード済みのengineが持つファイル全体長を直接引き継ぐ。
        const engineDurationSec = engine.getDuration();
        refs.filesModeFileDurationSec.current = engineDurationSec > 0 ? engineDurationSec : null;
      }

      if (reusesLoadedAsset) {
        const seekSec = pendingSeekSec ?? getTrackStart(track);
        const trackDuration = getTrackDurationSec(track, refs.filesModeFileDurationSec.current);
        engine.seek(seekSec);
        const relativeTime = toTrackRelativeTime(seekSec, track, trackDuration);
        controller.dispatch({ type: "audioTimeUpdated", positionSec: relativeTime });
        refs.updateMediaSessionPosition.current(relativeTime);

        if (autoplay) {
          engine.play();
        }

        updateLastPlayed(workId).catch(() => {});
        return;
      }

      // durationSec は startRequested/trackSelected で選択時点の DTO 値が既に反映済み。
      // 位置だけ 0 へ戻す（登録トラックは正確な durationSec、Files モードは durationchange を待つ）。
      controller.dispatch({ type: "audioTimeUpdated", positionSec: 0 });

      refs.loadCleanup.current?.();
      refs.loadCleanup.current = engine.load(assetUrl, {
        playbackRate: refs.coreState.current.playbackRate,
        startSec:
          pendingSeekSec === undefined && track.start !== undefined ? track.start : undefined,
        pendingSeekSec,
        autoplay,
      });

      updateLastPlayed(workId).catch(() => {});
    },
    [refs, controller, consumePendingResume],
  );

  return { getCurrentPlaybackContext, loadTrack };
}
