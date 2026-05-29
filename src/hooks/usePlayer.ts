import { useState, useRef, useCallback, useEffect } from "react";
import type { Track, WorkSummary, Work } from "../types";
import * as api from "../api";

export interface PlayerState {
  isPlaying: boolean;
  currentTrackIndex: number;
  currentWork: WorkSummary | Work | null;
  tracks: Track[];
  currentTime: number;
  duration: number;
  volume: number;
  loop: boolean;
  showFullPlayer: boolean;
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: { a: number | null; b: number | null };
}

export function usePlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loopRef = useRef(false);
  const abRepeatRef = useRef<{ a: number | null; b: number | null }>({ a: null, b: null });
  const audioContextRef = useRef<AudioContext | null>(null);
  const channelSwapNodeRef = useRef<{ splitter: ChannelSplitterNode; merger: ChannelMergerNode } | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const channelSwapEnabledRef = useRef(false);
  const playbackRateRef = useRef(1.0);
  const resumeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingResumeRef = useRef<{ workId: string; trackIndex: number; position: number } | null>(null);
  const loadedTrackRef = useRef<{ workId: string; trackIndex: number } | null>(null);

  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    currentTrackIndex: -1,
    currentWork: null,
    tracks: [],
    currentTime: 0,
    duration: 0,
    volume: 75,
    loop: false,
    showFullPlayer: false,
    playbackRate: 1.0,
    channelSwap: false,
    abRepeat: { a: null, b: null },
  });

  // Keep refs in sync with state
  loopRef.current = state.loop;
  abRepeatRef.current = state.abRepeat;
  channelSwapEnabledRef.current = state.channelSwap;
  playbackRateRef.current = state.playbackRate;

  const resumeAudioContext = useCallback(() => {
    const ctx = audioContextRef.current;
    if (ctx?.state === "suspended") {
      ctx.resume().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.volume = state.volume / 100;
    }

    const audio = audioRef.current;

    const onTimeUpdate = () => {
      const ab = abRepeatRef.current;
      if (ab.a !== null && ab.b !== null && audio.currentTime >= ab.b) {
        audio.currentTime = ab.a;
      }
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    };
    const onDurationChange = () => {
      setState((s) => ({ ...s, duration: audio.duration || 0 }));
    };
    const onEnded = () => {
      if (loopRef.current) {
        audio.currentTime = 0;
        audio.play();
      } else {
        const loadedTrack = loadedTrackRef.current;
        if (loadedTrack) {
          api.saveResumePosition(loadedTrack.workId, audio.duration || audio.currentTime, loadedTrack.trackIndex)
            .catch(() => {});
        }
        // Auto-advance to next track
        setState((prev) => {
          if (prev.currentTrackIndex < prev.tracks.length - 1) {
            return { ...prev, currentTrackIndex: prev.currentTrackIndex + 1 };
          }
          return { ...prev, isPlaying: false };
        });
      }
    };
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save resume position periodically
  useEffect(() => {
    if (state.isPlaying && state.currentWork) {
      const workId = state.currentWork.id;
      resumeTimerRef.current = setInterval(() => {
        if (audioRef.current && state.currentWork?.id === workId) {
          api.saveResumePosition(workId, audioRef.current.currentTime, state.currentTrackIndex)
            .catch(() => {});
        }
      }, 5000);
    }
    return () => {
      if (resumeTimerRef.current) {
        clearInterval(resumeTimerRef.current);
        resumeTimerRef.current = null;
      }
    };
  }, [state.isPlaying, state.currentWork, state.currentTrackIndex]);

  // Save resume on pause/stop
  useEffect(() => {
    if (!state.isPlaying && state.currentWork && audioRef.current && state.currentTrackIndex >= 0) {
      api.saveResumePosition(state.currentWork.id, audioRef.current.currentTime, state.currentTrackIndex)
        .catch(() => {});
    }
  }, [state.isPlaying, state.currentWork, state.currentTrackIndex]);

  // Load and play when track index changes
  useEffect(() => {
    if (
      state.currentTrackIndex >= 0 &&
      state.currentTrackIndex < state.tracks.length &&
      state.currentWork &&
      audioRef.current
    ) {
      const track = state.tracks[state.currentTrackIndex];
      const workId = state.currentWork.id;
      const encoded = track.file.split("/").map(encodeURIComponent).join("/");
      const assetUrl = `/api/audio/${encodeURIComponent(workId)}/${encoded}`;
      const audio = audioRef.current;
      const previousTrack = loadedTrackRef.current;

      if (
        previousTrack &&
        (previousTrack.workId !== workId || previousTrack.trackIndex !== state.currentTrackIndex)
      ) {
        api.saveResumePosition(previousTrack.workId, audio.currentTime, previousTrack.trackIndex)
          .catch(() => {});
      }

      const pendingResume = pendingResumeRef.current;
      const shouldResume =
        pendingResume?.workId === workId &&
        pendingResume.trackIndex === state.currentTrackIndex &&
        pendingResume.position > 0;

      const seekAfterMetadata = () => {
        if (shouldResume) {
          audio.currentTime = pendingResume.position;
          pendingResumeRef.current = null;
          audio.removeEventListener("loadedmetadata", seekAfterMetadata);
          audio.removeEventListener("canplay", seekAfterMetadata);
        }
      };

      if (shouldResume) {
        audio.addEventListener("loadedmetadata", seekAfterMetadata, { once: true });
        audio.addEventListener("canplay", seekAfterMetadata, { once: true });
      }

      audio.src = assetUrl;
      audio.playbackRate = playbackRateRef.current;

      if (shouldResume && audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
        seekAfterMetadata();
      } else if (!shouldResume && track.start !== undefined) {
        audio.currentTime = track.start;
      }

      resumeAudioContext();
      audio.play().catch(() => {});
      loadedTrackRef.current = { workId, trackIndex: state.currentTrackIndex };

      // Update last played
      api.updateLastPlayed(state.currentWork.id).catch(() => {});

      return () => {
        audio.removeEventListener("loadedmetadata", seekAfterMetadata);
        audio.removeEventListener("canplay", seekAfterMetadata);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.currentTrackIndex, state.tracks, state.currentWork, resumeAudioContext]);

  // Setup Web Audio API for channel swap
  const setupChannelSwap = useCallback(() => {
    if (!audioRef.current) return;
    if (audioContextRef.current) return; // already set up

    const ctx = new AudioContext();
    audioContextRef.current = ctx;
    ctx.resume().catch(() => {});

    const source = ctx.createMediaElementSource(audioRef.current);
    sourceNodeRef.current = source;

    const splitter = ctx.createChannelSplitter(2);
    const merger = ctx.createChannelMerger(2);
    channelSwapNodeRef.current = { splitter, merger };

    // Connect normally first
    source.connect(ctx.destination);
  }, []);

  const applyChannelSwap = useCallback((enabled: boolean) => {
    if (!audioContextRef.current || !sourceNodeRef.current || !channelSwapNodeRef.current) {
      if (enabled) {
        setupChannelSwap();
        // retry after setup
        setTimeout(() => {
          if (audioContextRef.current && sourceNodeRef.current && channelSwapNodeRef.current) {
            applyChannelSwapInternal(enabled);
          }
        }, 100);
        return;
      }
      return;
    }
    applyChannelSwapInternal(enabled);
  }, [setupChannelSwap]);

  const applyChannelSwapInternal = (enabled: boolean) => {
    const ctx = audioContextRef.current!;
    const source = sourceNodeRef.current!;
    const { splitter, merger } = channelSwapNodeRef.current!;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    source.disconnect();

    if (enabled) {
      source.connect(splitter);
      splitter.connect(merger, 0, 1); // L -> R
      splitter.connect(merger, 1, 0); // R -> L
      merger.connect(ctx.destination);
    } else {
      source.connect(ctx.destination);
    }
  };

  const play = useCallback(
    (work: WorkSummary | Work, tracks: Track[], trackIndex: number = 0) => {
      // Clear A-B repeat on new play
      pendingResumeRef.current = null;
      setState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        abRepeat: { a: null, b: null },
      }));
    },
    []
  );

  const playWithResume = useCallback(
    (work: Work) => {
      const defaultPlaylist = work.playlists.find(
        (p) => p.name === (work.defaultPlaylist || "default")
      );
      const tracks = defaultPlaylist?.tracks || work.playlists[0]?.tracks || [];
      if (tracks.length === 0) return;

      const trackIndex = Math.min(work.resumeTrackIndex, tracks.length - 1);

      setState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        abRepeat: { a: null, b: null },
      }));

      if (work.resumePosition > 0) {
        pendingResumeRef.current = {
          workId: work.id,
          trackIndex,
          position: work.resumePosition,
        };
      }
    },
    []
  );

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) {
      resumeAudioContext();
      audioRef.current.play();
    } else {
      audioRef.current.pause();
    }
  }, [resumeAudioContext]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      const loadedTrack = loadedTrackRef.current;
      if (loadedTrack) {
        api.saveResumePosition(loadedTrack.workId, audioRef.current.currentTime, loadedTrack.trackIndex)
          .catch(() => {});
      }
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    loadedTrackRef.current = null;
    pendingResumeRef.current = null;
    setState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackIndex: -1,
      currentWork: null,
      tracks: [],
    }));
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  }, []);

  const seekRelative = useCallback((delta: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(
        0,
        Math.min(audioRef.current.duration, audioRef.current.currentTime + delta)
      );
    }
  }, []);

  const setVolume = useCallback((vol: number) => {
    const v = Math.max(0, Math.min(100, vol));
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
    setState((prev) => ({ ...prev, volume: v }));
  }, []);

  const setLoop = useCallback((loop: boolean) => {
    setState((prev) => ({ ...prev, loop }));
  }, []);

  const nextTrack = useCallback(() => {
    setState((prev) => {
      if (prev.currentTrackIndex < prev.tracks.length - 1) {
        return { ...prev, currentTrackIndex: prev.currentTrackIndex + 1, abRepeat: { a: null, b: null } };
      }
      return prev;
    });
  }, []);

  const prevTrack = useCallback(() => {
    setState((prev) => {
      if (prev.currentTrackIndex > 0) {
        return { ...prev, currentTrackIndex: prev.currentTrackIndex - 1, abRepeat: { a: null, b: null } };
      }
      return prev;
    });
  }, []);

  const setTrackIndex = useCallback((index: number) => {
    setState((prev) => ({ ...prev, currentTrackIndex: index, abRepeat: { a: null, b: null } }));
  }, []);

  const setShowFullPlayer = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showFullPlayer: show }));
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    if (audioRef.current) {
      audioRef.current.playbackRate = rate;
    }
    setState((prev) => ({ ...prev, playbackRate: rate }));
  }, []);

  const setChannelSwap = useCallback((enabled: boolean) => {
    resumeAudioContext();
    applyChannelSwap(enabled);
    setState((prev) => ({ ...prev, channelSwap: enabled }));
  }, [applyChannelSwap, resumeAudioContext]);

  const setABPoint = useCallback((point: "a" | "b") => {
    if (!audioRef.current) return;
    const time = audioRef.current.currentTime;
    setState((prev) => ({
      ...prev,
      abRepeat: { ...prev.abRepeat, [point]: time },
    }));
  }, []);

  const clearABRepeat = useCallback(() => {
    setState((prev) => ({
      ...prev,
      abRepeat: { a: null, b: null },
    }));
  }, []);

  return {
    state,
    play,
    playWithResume,
    togglePlay,
    stop,
    seek,
    seekRelative,
    setVolume,
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

// Helper to format seconds to time string
export function formatTime(sec: number): string {
  if (!sec || !isFinite(sec)) return "0:00";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatDuration(totalSec: number): string {
  if (!totalSec) return "0:00";
  return formatTime(totalSec);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
