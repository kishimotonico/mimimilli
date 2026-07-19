import { useCallback, useEffect, useRef } from "react";
import type { ResumeBody } from "@mimimilli/shared";
import type { Track } from "../../../entities/work/model";
import { saveResumePosition } from "../api";
import { getTrackStart, toTrackRelativeTime } from "./trackTime";
import type { LoadedTrack, MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlayerCoreState } from "./atoms";

interface UseResumePersistenceOptions {
  refs: Pick<PlayerRuntimeRefs, "engine" | "loadedTrack" | "trackEnded">;
}

export function useResumePersistenceController({ refs }: UseResumePersistenceOptions) {
  const pendingResumeRef = useRef<PendingResume | null>(null);
  const savePromiseRef = useRef<Promise<void> | null>(null);

  const enqueueResumeSave = useCallback((workId: string, resume: ResumeBody) => {
    const save = () => saveResumePosition(workId, resume).catch(() => {});
    const currentSave = savePromiseRef.current;
    const nextSave = currentSave ? currentSave.then(save, save) : save();

    savePromiseRef.current = nextSave;
    void nextSave.then(() => {
      if (savePromiseRef.current === nextSave) {
        savePromiseRef.current = null;
      }
    });
  }, []);

  const saveCurrentResume = useCallback(
    (absolutePosition?: number, loadedTrack: LoadedTrack | null = refs.loadedTrack.current) => {
      if (!loadedTrack) return;

      const position = absolutePosition ?? refs.engine.current?.getCurrentTime();
      if (position === undefined) return;

      if (loadedTrack.playlistId === null) return;
      const trackDuration =
        loadedTrack.track.end === undefined
          ? Number.POSITIVE_INFINITY
          : loadedTrack.track.end - getTrackStart(loadedTrack.track);
      const offsetSec = toTrackRelativeTime(position, loadedTrack.track, trackDuration);
      enqueueResumeSave(loadedTrack.workId, {
        playlistId: loadedTrack.playlistId,
        trackId: loadedTrack.track.id,
        offsetSec,
      });
    },
    [enqueueResumeSave, refs.engine, refs.loadedTrack],
  );

  const consumePendingResume = useCallback(
    (workId: string, playlistId: string | null, track: Track) => {
      const pending = pendingResumeRef.current;
      if (
        pending?.workId !== workId ||
        pending.playlistId !== playlistId ||
        pending.trackId !== track.id ||
        pending.offsetSec <= 0
      ) {
        return undefined;
      }

      pendingResumeRef.current = null;
      return getTrackStart(track) + pending.offsetSec;
    },
    [],
  );

  return {
    pendingResumeRef: pendingResumeRef as MutableRef<PendingResume | null>,
    consumePendingResume,
    enqueueResumeSave,
    saveCurrentResume,
  };
}

interface UseResumePersistenceEffectsOptions extends UseResumePersistenceOptions {
  coreState: PlayerCoreState;
  saveCurrentResume: ReturnType<typeof useResumePersistenceController>["saveCurrentResume"];
}

export function useResumePersistence({
  coreState,
  refs,
  saveCurrentResume,
}: UseResumePersistenceEffectsOptions) {
  // 再生中は5秒ごとに現在位置を保存する。
  useEffect(() => {
    if (!coreState.isPlaying || !coreState.currentWork || !refs.engine.current) return;

    const workId = coreState.currentWork.id;
    const intervalId = setInterval(() => {
      const loaded = refs.loadedTrack.current;
      if (!refs.trackEnded.current && loaded?.workId === workId) {
        saveCurrentResume();
      }
    }, 5000);
    return () => clearInterval(intervalId);
  }, [
    coreState.isPlaying,
    coreState.currentWork,
    coreState.currentTrackIndex,
    refs.engine,
    refs.loadedTrack,
    refs.trackEnded,
    saveCurrentResume,
  ]);

  // 一時停止した時点の位置を保存する。聴了処理の直後は先頭リセットを上書きしない。
  useEffect(() => {
    if (
      coreState.isPlaying ||
      refs.trackEnded.current ||
      !coreState.currentWork ||
      coreState.currentTrackIndex < 0 ||
      !refs.engine.current
    ) {
      return;
    }

    if (refs.loadedTrack.current) {
      saveCurrentResume();
    }
  }, [
    coreState.isPlaying,
    coreState.currentWork,
    coreState.currentTrackIndex,
    refs.engine,
    refs.loadedTrack,
    refs.trackEnded,
    saveCurrentResume,
  ]);
}
