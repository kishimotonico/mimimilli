import { useCallback, useEffect, useMemo } from "react";
import type { Track, Work, WorkSummary } from "../../../entities/work/model";
import { getCircleName } from "../../../entities/work/model";
import { getCoverImageUrl } from "../../../entities/work/api";

const DEFAULT_SEEK_OFFSET = 10;
const ARTWORK_WIDTH = 512;

interface MediaSessionPosition {
  duration: number;
  position: number;
  playbackRate: number;
}

interface UseMediaSessionOptions {
  currentWork: WorkSummary | Work | null;
  currentTrack: Track | null;
  currentTrackIndex: number;
  trackCount: number;
  isPlaying: boolean;
  playbackRate: number;
  getPosition: () => MediaSessionPosition | null;
  onPlay: () => void;
  onPause: () => void;
  onPreviousTrack: () => void;
  onNextTrack: () => void;
  onSeek: (position: number) => void;
  onSeekRelative: (offset: number) => void;
}

function getSupportedMediaSession(): MediaSession | null {
  if (
    typeof navigator === "undefined" ||
    !("mediaSession" in navigator) ||
    typeof MediaMetadata === "undefined"
  ) {
    return null;
  }
  return navigator.mediaSession;
}

export function useMediaSession({
  currentWork,
  currentTrack,
  currentTrackIndex,
  trackCount,
  isPlaying,
  playbackRate,
  getPosition,
  onPlay,
  onPause,
  onPreviousTrack,
  onNextTrack,
  onSeek,
  onSeekRelative,
}: UseMediaSessionOptions): (position?: number) => void {
  const mediaSession = useMemo(getSupportedMediaSession, []);
  const isActive = currentWork !== null && currentTrack !== null;
  const hasPreviousTrack = currentTrackIndex > 0;
  const hasNextTrack = currentTrackIndex >= 0 && currentTrackIndex < trackCount - 1;

  const updatePositionState = useCallback(
    (position?: number) => {
      if (!mediaSession) return;

      const state = getPosition();
      if (
        !state ||
        !Number.isFinite(state.duration) ||
        state.duration <= 0 ||
        !Number.isFinite(state.position) ||
        !Number.isFinite(state.playbackRate) ||
        state.playbackRate <= 0
      ) {
        mediaSession.setPositionState();
        return;
      }

      mediaSession.setPositionState({
        duration: state.duration,
        position: Math.max(0, Math.min(position ?? state.position, state.duration)),
        playbackRate: state.playbackRate,
      });
    },
    [getPosition, mediaSession],
  );

  useEffect(() => {
    if (!mediaSession) return;

    if (!currentWork || !currentTrack) {
      mediaSession.metadata = null;
      return;
    }

    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: getCircleName(currentWork) ?? "",
      album: currentWork.title,
      artwork: currentWork.coverImage
        ? [{ src: getCoverImageUrl(currentWork.id, ARTWORK_WIDTH) }]
        : [],
    });
  }, [currentTrack, currentWork, mediaSession]);

  useEffect(() => {
    if (!mediaSession) return;

    mediaSession.setActionHandler("play", isActive ? onPlay : null);
    mediaSession.setActionHandler("pause", isActive ? onPause : null);
    mediaSession.setActionHandler("previoustrack", hasPreviousTrack ? onPreviousTrack : null);
    mediaSession.setActionHandler("nexttrack", hasNextTrack ? onNextTrack : null);
    mediaSession.setActionHandler(
      "seekbackward",
      isActive
        ? (details) => {
            onSeekRelative(-(details.seekOffset ?? DEFAULT_SEEK_OFFSET));
          }
        : null,
    );
    mediaSession.setActionHandler(
      "seekforward",
      isActive
        ? (details) => {
            onSeekRelative(details.seekOffset ?? DEFAULT_SEEK_OFFSET);
          }
        : null,
    );
    mediaSession.setActionHandler(
      "seekto",
      isActive
        ? (details) => {
            if (details.seekTime !== undefined) onSeek(details.seekTime);
          }
        : null,
    );

    return () => {
      mediaSession.setActionHandler("play", null);
      mediaSession.setActionHandler("pause", null);
      mediaSession.setActionHandler("previoustrack", null);
      mediaSession.setActionHandler("nexttrack", null);
      mediaSession.setActionHandler("seekbackward", null);
      mediaSession.setActionHandler("seekforward", null);
      mediaSession.setActionHandler("seekto", null);
    };
  }, [
    hasNextTrack,
    hasPreviousTrack,
    isActive,
    mediaSession,
    onNextTrack,
    onPause,
    onPlay,
    onPreviousTrack,
    onSeek,
    onSeekRelative,
  ]);

  useEffect(() => {
    if (!mediaSession) return;

    mediaSession.playbackState = currentWork ? (isPlaying ? "playing" : "paused") : "none";
    updatePositionState();
  }, [currentTrackIndex, currentWork, isPlaying, mediaSession, playbackRate, updatePositionState]);

  useEffect(
    () => () => {
      if (!mediaSession) return;
      mediaSession.metadata = null;
      mediaSession.playbackState = "none";
      mediaSession.setPositionState();
    },
    [mediaSession],
  );

  return updatePositionState;
}
