import { useCallback, useEffect, useRef } from "react";
import type { Track } from "../../../entities/work/model";
import { saveResumePosition } from "../api";
import { getTrackStart } from "./trackTime";
import type { LoadedTrack, MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";
import type { PlayerCoreState } from "./atoms";

interface UseResumePersistenceOptions {
  refs: Pick<PlayerRuntimeRefs, "engine" | "loadedTrack" | "trackEnded">;
}

export function useResumePersistenceController({ refs }: UseResumePersistenceOptions) {
  const pendingResumeRef = useRef<PendingResume | null>(null);

  const saveCurrentResume = useCallback(
    (absolutePosition?: number, loadedTrack: LoadedTrack | null = refs.loadedTrack.current) => {
      if (!loadedTrack) return;

      const position = absolutePosition ?? refs.engine.current?.getCurrentTime();
      if (position === undefined) return;

      // resumePosition は既存データとの互換性を保つため、ファイル絶対秒で保存する。
      saveResumePosition(loadedTrack.workId, position, loadedTrack.trackIndex).catch(() => {});
    },
    [refs.engine, refs.loadedTrack],
  );

  const consumePendingResume = useCallback((workId: string, trackIndex: number, track: Track) => {
    const pending = pendingResumeRef.current;
    if (pending?.workId !== workId || pending.trackIndex !== trackIndex || pending.position <= 0) {
      return undefined;
    }

    pendingResumeRef.current = null;
    return Math.max(
      getTrackStart(track),
      track.end === undefined ? pending.position : Math.min(track.end, pending.position),
    );
  }, []);

  return {
    pendingResumeRef: pendingResumeRef as MutableRef<PendingResume | null>,
    consumePendingResume,
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
