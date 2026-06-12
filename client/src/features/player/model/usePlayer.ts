// player feature の React フック。
// audioEngine（低レベル Audio 操作）と Jotai atoms（state）を橋渡しする。
//
// 高頻度更新（currentTime / duration）は atoms から直接 subscribe せず useSetAtom で書くだけ。
// → App.tsx が player を使っても timeupdate による re-render が起きない。
// → TransportBar / FullScreenPlayer だけが playerCurrentTimeAtom を subscribe する。

import { useRef, useCallback, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import type { Track, WorkSummary, Work } from "../../../entities/work/model";
import { getAudioUrl } from "../../../entities/work/api";
import { saveResumePosition, updateLastPlayed } from "../api";
import { createAudioEngine } from "./audioEngine";
import {
  playerCoreAtom,
  playerCurrentTimeAtom,
  playerDurationAtom,
  type PlayerCoreState,
} from "./atoms";
import { formatTime, formatDuration, formatFileSize } from "../../../shared/lib/format";

// ── 後方互換 re-export ─────────────────────────────────────────
export { formatTime, formatDuration, formatFileSize };
export type { PlayerCoreState };

/**
 * PlayerState: コンポーネントの props として渡す state。
 * currentTime / duration は含まない — TransportBar / FullScreenPlayer は
 * playerCurrentTimeAtom / playerDurationAtom から直接読む。
 */
export type PlayerState = PlayerCoreState;

// ── pending resume ref の型 ───────────────────────────────────
interface PendingResume {
  workId: string;
  trackIndex: number;
  position: number;
}

export function usePlayer() {
  const [coreState, setCoreState] = useAtom(playerCoreAtom);
  const setCurrentTime = useSetAtom(playerCurrentTimeAtom); // subscribe しない
  const setDuration = useSetAtom(playerDurationAtom);       // subscribe しない

  // loopRef: onEnded callback が最新の loop 値を参照するための ref
  const loopRef = useRef(coreState.loop);
  loopRef.current = coreState.loop;

  const abRepeatRef = useRef(coreState.abRepeat);
  abRepeatRef.current = coreState.abRepeat;

  const pendingResumeRef = useRef<PendingResume | null>(null);
  const loadedTrackRef = useRef<{ workId: string; trackIndex: number } | null>(null);

  // Audio engine を useRef で保持（再マウントしない）
  const engineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);

  if (!engineRef.current) {
    engineRef.current = createAudioEngine(coreState.volume, {
      onPlay: () => setCoreState((s) => ({ ...s, isPlaying: true })),
      onPause: () => setCoreState((s) => ({ ...s, isPlaying: false })),
      onTimeUpdate: (time) => {
        // A-B リピート（ref 経由で最新値を参照）
        const ab = abRepeatRef.current;
        if (ab.a !== null && ab.b !== null && time >= ab.b) {
          engineRef.current?.seek(ab.a);
        }
        setCurrentTime(time);
      },
      onDurationChange: (dur) => setDuration(dur),
      onEnded: () => {
        if (loopRef.current) {
          engineRef.current?.seek(0);
          engineRef.current?.play();
          return;
        }
        // トラック終了時に resume position を保存
        const loadedTrack = loadedTrackRef.current;
        if (loadedTrack) {
          const dur = engineRef.current?.getDuration() ?? 0;
          saveResumePosition(loadedTrack.workId, dur, loadedTrack.trackIndex).catch(() => {});
        }
        // 次トラックへ自動送り
        setCoreState((prev) => {
          if (prev.currentTrackIndex < prev.tracks.length - 1) {
            return { ...prev, currentTrackIndex: prev.currentTrackIndex + 1 };
          }
          return { ...prev, isPlaying: false };
        });
      },
    });
  }

  const engine = engineRef.current;

  // ── トラック変更時に読み込み・再生 ────────────────────────
  const coreStateRef = useRef(coreState);
  coreStateRef.current = coreState;

  useEffect(() => {
    const { currentTrackIndex, tracks, currentWork } = coreState;
    if (currentTrackIndex < 0 || currentTrackIndex >= tracks.length || !currentWork) return;

    const track = tracks[currentTrackIndex];
    const workId = currentWork.id;
    const assetUrl = getAudioUrl(workId, track.file);

    // 前トラックの位置を保存
    const prev = loadedTrackRef.current;
    if (prev && (prev.workId !== workId || prev.trackIndex !== currentTrackIndex)) {
      const time = engine.getCurrentTime();
      saveResumePosition(prev.workId, time, prev.trackIndex).catch(() => {});
    }

    // pending resume の確認
    const pending = pendingResumeRef.current;
    const pendingSeekSec =
      pending?.workId === workId && pending.trackIndex === currentTrackIndex && pending.position > 0
        ? pending.position
        : undefined;

    if (pendingSeekSec) {
      pendingResumeRef.current = null;
    }

    const cleanup = engine.load(assetUrl, {
      playbackRate: coreState.playbackRate,
      startSec: pendingSeekSec === undefined && track.start !== undefined ? track.start : undefined,
      pendingSeekSec,
    });

    loadedTrackRef.current = { workId, trackIndex: currentTrackIndex };
    updateLastPlayed(workId).catch(() => {});

    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coreState.currentTrackIndex, coreState.tracks, coreState.currentWork]);

  // ── 定期 resume 保存 ──────────────────────────────────────
  useEffect(() => {
    if (!coreState.isPlaying || !coreState.currentWork) return;
    const workId = coreState.currentWork.id;
    const tid = setInterval(() => {
      const loaded = loadedTrackRef.current;
      if (loaded && loaded.workId === workId) {
        saveResumePosition(workId, engine.getCurrentTime(), loaded.trackIndex).catch(() => {});
      }
    }, 5000);
    return () => clearInterval(tid);
  }, [coreState.isPlaying, coreState.currentWork, coreState.currentTrackIndex, engine]);

  // ── 一時停止時に resume 保存 ──────────────────────────────
  useEffect(() => {
    if (coreState.isPlaying || !coreState.currentWork || coreState.currentTrackIndex < 0) return;
    const loaded = loadedTrackRef.current;
    if (loaded) {
      saveResumePosition(loaded.workId, engine.getCurrentTime(), loaded.trackIndex).catch(() => {});
    }
  }, [coreState.isPlaying, coreState.currentWork, coreState.currentTrackIndex, engine]);

  // ── cleanup on unmount ────────────────────────────────────
  useEffect(() => {
    return () => { engine.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── アクション ────────────────────────────────────────────

  const play = useCallback(
    (work: WorkSummary | Work, tracks: Track[], trackIndex: number = 0) => {
      pendingResumeRef.current = null;
      setCoreState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState]
  );

  const playWithResume = useCallback(
    (work: Work) => {
      const playlist = work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default"))
        ?? work.playlists[0];
      const tracks = playlist?.tracks ?? [];
      if (tracks.length === 0) return;

      const trackIndex = Math.min(work.resumeTrackIndex, tracks.length - 1);

      if (work.resumePosition > 0) {
        pendingResumeRef.current = { workId: work.id, trackIndex, position: work.resumePosition };
      }

      setCoreState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState]
  );

  const togglePlay = useCallback(() => {
    if (coreState.isPlaying) {
      engine.pause();
    } else {
      engine.play();
    }
  }, [coreState.isPlaying, engine]);

  const stop = useCallback(() => {
    const loaded = loadedTrackRef.current;
    if (loaded) {
      saveResumePosition(loaded.workId, engine.getCurrentTime(), loaded.trackIndex).catch(() => {});
    }
    engine.pause();
    engine.seek(0);
    loadedTrackRef.current = null;
    pendingResumeRef.current = null;
    setCoreState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackIndex: -1,
      currentWork: null,
      tracks: [],
    }));
  }, [engine, setCoreState]);

  const seek = useCallback((time: number) => engine.seek(time), [engine]);
  const seekRelative = useCallback((delta: number) => engine.seekRelative(delta), [engine]);

  const setVolume = useCallback((vol: number) => {
    engine.setVolume(vol);
    setCoreState((prev) => ({ ...prev, volume: Math.max(0, Math.min(100, vol)) }));
  }, [engine, setCoreState]);

  const setLoop = useCallback((loop: boolean) => {
    setCoreState((prev) => ({ ...prev, loop }));
  }, [setCoreState]);

  const nextTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex < prev.tracks.length - 1) {
        return { ...prev, currentTrackIndex: prev.currentTrackIndex + 1, abRepeat: { a: null, b: null } };
      }
      return prev;
    });
  }, [setCoreState]);

  const prevTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex > 0) {
        return { ...prev, currentTrackIndex: prev.currentTrackIndex - 1, abRepeat: { a: null, b: null } };
      }
      return prev;
    });
  }, [setCoreState]);

  const setTrackIndex = useCallback((index: number) => {
    setCoreState((prev) => ({ ...prev, currentTrackIndex: index, abRepeat: { a: null, b: null } }));
  }, [setCoreState]);

  const setShowFullPlayer = useCallback((show: boolean) => {
    setCoreState((prev) => ({ ...prev, showFullPlayer: show }));
  }, [setCoreState]);

  const setPlaybackRate = useCallback((rate: number) => {
    engine.setPlaybackRate(rate);
    setCoreState((prev) => ({ ...prev, playbackRate: rate }));
  }, [engine, setCoreState]);

  const setChannelSwap = useCallback((enabled: boolean) => {
    engine.setChannelSwap(enabled);
    setCoreState((prev) => ({ ...prev, channelSwap: enabled }));
  }, [engine, setCoreState]);

  const setABPoint = useCallback((point: "a" | "b") => {
    const time = engine.getCurrentTime();
    setCoreState((prev) => ({
      ...prev,
      abRepeat: { ...prev.abRepeat, [point]: time },
    }));
  }, [engine, setCoreState]);

  const clearABRepeat = useCallback(() => {
    setCoreState((prev) => ({ ...prev, abRepeat: { a: null, b: null } }));
  }, [setCoreState]);

  return {
    state: coreState,
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
