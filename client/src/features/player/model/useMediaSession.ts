import { useCallback, useEffect, useMemo } from "react";
import type { Work, WorkListItem } from "../../../entities/work/model";
import { getCircleName } from "../../../entities/work/model";
import { getCoverImageUrl } from "../../../entities/work/api";
import { hasResolvedPlaybackSource } from "../../../entities/player/model/playerCoreState";
import type { PlaybackTrack } from "./trackTime";

const DEFAULT_SEEK_OFFSET = 10;
const ARTWORK_WIDTH = 512;

interface MediaSessionPosition {
  duration: number | null;
  position: number;
  playbackRate: number;
}

interface UseMediaSessionOptions {
  currentWork: WorkListItem | Work | null;
  isFilePlayback: boolean;
  currentTrack: PlaybackTrack | null;
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

function trySetActionHandler(
  mediaSession: MediaSession,
  action: MediaSessionAction,
  handler: MediaSessionActionHandler | null,
) {
  try {
    mediaSession.setActionHandler(action, handler);
  } catch {
    // ブラウザが個別の Media Session action に未対応の場合は、その action だけ無効にする。
  }
}

export function useMediaSession({
  currentWork,
  isFilePlayback,
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
  const isActive = (currentWork !== null || isFilePlayback) && currentTrack !== null;
  const hasPreviousTrack = currentTrackIndex > 0;
  const hasNextTrack = currentTrackIndex >= 0 && currentTrackIndex < trackCount - 1;

  const updatePositionState = useCallback(
    (position?: number) => {
      if (!mediaSession) return;

      const state = getPosition();
      if (
        !state ||
        state.duration === null ||
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

    const source = { currentWork, isFilePlayback };
    if (!currentTrack || !hasResolvedPlaybackSource(source)) {
      mediaSession.metadata = null;
      return;
    }

    mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: source.isFilePlayback ? "" : (getCircleName(source.currentWork) ?? ""),
      album: source.isFilePlayback ? "" : source.currentWork.title,
      artwork:
        !source.isFilePlayback && source.currentWork.cover
          ? [
              {
                src: getCoverImageUrl(
                  source.currentWork.id,
                  source.currentWork.cover.version,
                  ARTWORK_WIDTH,
                ),
              },
            ]
          : [],
    });
  }, [currentTrack, currentWork, isFilePlayback, mediaSession]);

  useEffect(() => {
    if (!mediaSession) return;

    trySetActionHandler(mediaSession, "play", isActive ? onPlay : null);
    trySetActionHandler(mediaSession, "pause", isActive ? onPause : null);
    trySetActionHandler(mediaSession, "previoustrack", hasPreviousTrack ? onPreviousTrack : null);
    trySetActionHandler(mediaSession, "nexttrack", hasNextTrack ? onNextTrack : null);
    trySetActionHandler(
      mediaSession,
      "seekbackward",
      isActive
        ? (details) => {
            onSeekRelative(-(details.seekOffset ?? DEFAULT_SEEK_OFFSET));
          }
        : null,
    );
    trySetActionHandler(
      mediaSession,
      "seekforward",
      isActive
        ? (details) => {
            onSeekRelative(details.seekOffset ?? DEFAULT_SEEK_OFFSET);
          }
        : null,
    );
    trySetActionHandler(
      mediaSession,
      "seekto",
      isActive
        ? (details) => {
            if (details.seekTime !== undefined) onSeek(details.seekTime);
          }
        : null,
    );

    return () => {
      trySetActionHandler(mediaSession, "play", null);
      trySetActionHandler(mediaSession, "pause", null);
      trySetActionHandler(mediaSession, "previoustrack", null);
      trySetActionHandler(mediaSession, "nexttrack", null);
      trySetActionHandler(mediaSession, "seekbackward", null);
      trySetActionHandler(mediaSession, "seekforward", null);
      trySetActionHandler(mediaSession, "seekto", null);
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

    mediaSession.playbackState =
      currentWork || isFilePlayback ? (isPlaying ? "playing" : "paused") : "none";
    updatePositionState();
  }, [
    currentTrackIndex,
    currentWork,
    isFilePlayback,
    isPlaying,
    mediaSession,
    playbackRate,
    updatePositionState,
  ]);

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
