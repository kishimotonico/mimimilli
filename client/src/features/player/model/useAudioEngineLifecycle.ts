import { useCallback, useEffect } from "react";
import { workspacePath } from "@mimimilli/shared";
import { getAudioUrl } from "../../../entities/work/api";
import { getWorkspaceMediaUrl } from "../../../entities/file-system/api";
import { updateLastPlayed } from "../api";
import { createAudioEngine } from "../../../entities/player/model/audioEngine";
import {
  getTrackDurationSec,
  getTrackStart,
  toTrackRelativeTime,
} from "../../../entities/player/model/trackTime";
import type { PlaybackTrack } from "../../../entities/player/model/playbackTrack";
import type {
  PlaybackContext,
  PlayerRuntimeRefs,
} from "../../../entities/player/model/playerRuntime";
import type {
  PlaybackItem,
  PlayerController,
} from "../../../entities/player/model/playerController";

interface UseAudioEngineLifecycleOptions {
  refs: PlayerRuntimeRefs;
  controller: PlayerController;
  consumePendingResume: (
    workId: string,
    playlistId: string | null,
    track: PlaybackTrack,
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
      const { loaded, fileDurationSec } = controller.getState();
      if (!engine || !loaded) return null;

      const trackDuration = getTrackDurationSec(loaded.track, fileDurationSec);
      const currentTime = toTrackRelativeTime(
        absoluteCurrentTime ?? engine.getCurrentTime(),
        loaded.track,
        trackDuration,
      );
      return { engine, track: loaded.track, trackDuration, currentTime };
    },
    [refs.engine, controller],
  );

  useEffect(() => {
    const engineRef = refs.engine;
    const loadCleanupRef = refs.loadCleanup;

    const engine = createAudioEngine(controller.getState().volume, {
      onPlay: () => controller.dispatch({ type: "audioPlaying" }),
      onPause: () => controller.dispatch({ type: "audioPaused" }),
      onTimeUpdate: (audioSec) => controller.dispatch({ type: "audioTimeChanged", audioSec }),
      // durationchange は Files モードの即席トラック専用経路。登録トラックは DTO の durationSec が
      // 権威であり、controller 側で上書きしない。
      onDurationChange: (durationSec) => {
        controller.dispatch({ type: "audioDurationChanged", durationSec });
        refs.updateMediaSessionPosition.current();
      },
      onEnded: () => controller.dispatch({ type: "audioEnded" }),
      onError: (error) => {
        controller.dispatch({ type: "audioFailed", error });
      },
    });
    const prefs = controller.getState();
    engine.setPlaybackRate(prefs.playbackRate);
    engine.setChannelSwap(prefs.channelSwap);
    engineRef.current = engine;

    return () => {
      if (engineRef.current === engine) {
        engineRef.current = null;
        controller.dispatch({ type: "engineReleased" });
      }
      loadCleanupRef.current?.();
      loadCleanupRef.current = null;
      engine.destroy();
    };
  }, [controller, refs]);

  // loadTrack コマンドを実ロード/シークへ接続する。再生するかどうかは controller が決めた
  // autoplay に従う（無条件 playAudio() のような命令的副作用で状態機械を上書きしない）。
  const loadTrack = useCallback(
    (item: PlaybackItem, autoplay: boolean, reusesAsset: boolean) => {
      const engine = refs.engine.current;
      if (!engine) return;

      const track = item.tracks[item.trackIndex];
      if (!track) return;

      const workId = item.source.kind === "work" ? item.source.work.id : null;
      const pendingSeekSec =
        workId !== null ? consumePendingResume(workId, item.playlistId, track) : undefined;

      if (reusesAsset) {
        // 登録トラック→同一音源のFilesモード即席トラックへの切り替えでは再ロードもdurationchangeも
        // 発生しないため、既にロード済みのengineが持つファイル全体長を直接引き継ぐ。
        const engineDurationSec = engine.getDuration();
        if (engineDurationSec > 0) {
          controller.dispatch({ type: "audioDurationChanged", durationSec: engineDurationSec });
        }
        const seekSec = pendingSeekSec ?? getTrackStart(track);
        engine.seek(seekSec);
        controller.dispatch({ type: "audioTimeChanged", audioSec: seekSec });
        refs.updateMediaSessionPosition.current(controller.getState().positionSec);
        if (autoplay) engine.play();
        if (workId) updateLastPlayed(workId).catch(() => {});
        return;
      }

      const assetUrl =
        workId !== null
          ? getAudioUrl(workId, track.file)
          : getWorkspaceMediaUrl(workspacePath(track.file));

      // durationSec は startRequested/trackSelected で選択時点の DTO 値が既に反映済み。
      // 位置だけ 0 へ戻す（登録トラックは正確な durationSec、Files モードは durationchange を待つ）。
      controller.dispatch({ type: "audioTimeUpdated", positionSec: 0 });

      refs.loadCleanup.current?.();
      refs.loadCleanup.current = engine.load(assetUrl, {
        playbackRate: controller.getState().playbackRate,
        startSec:
          pendingSeekSec === undefined && track.start !== undefined ? track.start : undefined,
        pendingSeekSec,
        autoplay,
      });

      if (workId) updateLastPlayed(workId).catch(() => {});
    },
    [refs, controller, consumePendingResume],
  );

  return { getCurrentPlaybackContext, loadTrack };
}
