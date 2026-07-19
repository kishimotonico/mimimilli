import { useCallback, useRef } from "react";
import type { ResumeBody } from "@mimimilli/shared";
import type { Track, Work } from "../../../entities/work/model";
import { saveResumePosition } from "../api";
import { getTrackStart, toTrackRelativeTime } from "./trackTime";
import type { LoadedTrack, MutableRef, PendingResume, PlayerRuntimeRefs } from "./playerRuntime";

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

  const loadResume = useCallback((work: Work) => {
    const defaultPlaylist =
      work.playlists.find((candidate) => candidate.id === work.defaultPlaylistId) ??
      work.playlists[0];
    const persisted = work.resume;
    const persistedPlaylist = persisted
      ? work.playlists.find((candidate) => candidate.id === persisted.playlistId)
      : undefined;
    const persistedTrackIndex =
      persisted && persistedPlaylist
        ? persistedPlaylist.tracks.findIndex((candidate) => candidate.id === persisted.trackId)
        : -1;
    const hasValidResume =
      persisted !== null && persistedPlaylist !== undefined && persistedTrackIndex >= 0;
    const playlist = hasValidResume ? persistedPlaylist : defaultPlaylist;
    if (!playlist || playlist.tracks.length === 0) return null;

    const trackIndex = hasValidResume ? persistedTrackIndex : 0;
    const positionSec = hasValidResume ? persisted.offsetSec : 0;
    pendingResumeRef.current = hasValidResume ? { workId: work.id, ...persisted } : null;
    return { playlistId: playlist.id, tracks: playlist.tracks, trackIndex, positionSec };
  }, []);

  return {
    pendingResumeRef: pendingResumeRef as MutableRef<PendingResume | null>,
    consumePendingResume,
    enqueueResumeSave,
    saveCurrentResume,
    loadResume,
  };
}
