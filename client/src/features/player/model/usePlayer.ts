// player feature の React フック。
// audioEngine（低レベル Audio 操作）と Jotai atoms（state）を橋渡しする。
//
// 高頻度更新（currentTime / duration）は atoms から直接 subscribe せず useSetAtom で書くだけ。
// → App.tsx が player を使っても timeupdate による re-render が起きない。
// → BarContent / PopupContent / FullScreenPlayer だけが playerCurrentTimeAtom を subscribe する。

import { useRef, useCallback, useEffect } from "react";
import { useAtom, useSetAtom } from "jotai";
import type { Track, WorkSummary, Work } from "../../../entities/work/model";
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
 * currentTime / duration は含まない — BarContent / PopupContent / FullScreenPlayer は
 * playerCurrentTimeAtom / playerDurationAtom から直接読む。
 */
export type PlayerState = PlayerCoreState;

// ── pending resume ref の型 ───────────────────────────────────
interface PendingResume {
  workId: string;
  trackIndex: number;
  position: number;
}

interface LoadedTrack {
  workId: string;
  trackIndex: number;
  track: Track;
  assetUrl: string;
}

export function usePlayer() {
  const [coreState, setCoreState] = useAtom(playerCoreAtom);
  const setCurrentTime = useSetAtom(playerCurrentTimeAtom); // subscribe しない
  const setDuration = useSetAtom(playerDurationAtom); // subscribe しない

  // ── Audio engine と callback が読む最新状態 ───────────────
  const coreStateRef = useRef(coreState);
  coreStateRef.current = coreState;

  // loopRef: onEnded callback が最新の loop 値を参照するための ref
  const loopRef = useRef(coreState.loop);
  loopRef.current = coreState.loop;

  const abRepeatRef = useRef(coreState.abRepeat);
  abRepeatRef.current = coreState.abRepeat;

  const pendingResumeRef = useRef<PendingResume | null>(null);
  const loadedTrackRef = useRef<LoadedTrack | null>(null);
  const trackEndedRef = useRef(false);

  // Audio engine は effect の寿命に合わせて生成・破棄する。
  const engineRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);

  const getCurrentPlaybackContext = useCallback((absoluteCurrentTime?: number) => {
    const engine = engineRef.current;
    const loadedTrack = loadedTrackRef.current;
    if (!engine || !loadedTrack) return null;

    const trackDuration = getTrackDuration(loadedTrack.track, engine.getDuration());
    const currentTime = toTrackRelativeTime(
      absoluteCurrentTime ?? engine.getCurrentTime(),
      loadedTrack.track,
      trackDuration,
    );
    return { engine, track: loadedTrack.track, trackDuration, currentTime };
  }, []);

  const saveCurrentResume = useCallback(
    (absolutePosition?: number, loadedTrack: LoadedTrack | null = loadedTrackRef.current) => {
      if (!loadedTrack) return;

      const position = absolutePosition ?? engineRef.current?.getCurrentTime();
      if (position === undefined) return;

      // resumePosition は既存データとの互換性を保つため、ファイル絶対秒で保存する。
      saveResumePosition(loadedTrack.workId, position, loadedTrack.trackIndex).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    const finishCurrentTrack = (virtualEnd: boolean) => {
      if (trackEndedRef.current) return;
      trackEndedRef.current = true;

      const loadedTrack = loadedTrackRef.current;
      if (loopRef.current) {
        const start = loadedTrack ? getTrackStart(loadedTrack.track) : 0;
        engineRef.current?.seek(start);
        engineRef.current?.play();
        trackEndedRef.current = false;
        return;
      }

      // 同一ファイル内の次トラックへ進む場合は、再生を止めずにロード effect のシークへ渡す。
      const state = coreStateRef.current;
      const nextTrack = loadedTrack ? state.tracks[loadedTrack.trackIndex + 1] : undefined;
      const continuesSameAsset =
        loadedTrack !== null &&
        state.currentWork?.id === loadedTrack.workId &&
        nextTrack !== undefined &&
        getAudioUrl(loadedTrack.workId, nextTrack.file) === loadedTrack.assetUrl;

      // 区間トラックではファイル自体の再生が続くため、継続できない境界では明示的に止める。
      if (virtualEnd && !continuesSameAsset) engineRef.current?.pause();

      if (loadedTrack) {
        const absoluteEnd =
          loadedTrack.track.end ??
          engineRef.current?.getDuration() ??
          getTrackStart(loadedTrack.track);
        saveCurrentResume(absoluteEnd, loadedTrack);
      }

      setCoreState((prev) => {
        if (prev.currentTrackIndex < prev.tracks.length - 1) {
          return { ...prev, currentTrackIndex: prev.currentTrackIndex + 1 };
        }
        return { ...prev, isPlaying: false };
      });
    };

    const engine = createAudioEngine(coreStateRef.current.volume, {
      onPlay: () => setCoreState((s) => ({ ...s, isPlaying: true, playbackError: null })),
      onPause: () => setCoreState((s) => ({ ...s, isPlaying: false })),
      onTimeUpdate: (time) => {
        const context = getCurrentPlaybackContext(time);
        if (!context) return;
        const { engine, track, trackDuration, currentTime } = context;
        const reachedTrackEnd = hasReachedTrackEnd(time, track);

        // 終端より手前へ戻ったら、同じトラックでも次の終端到達を検知できるよう再武装する。
        if (!reachedTrackEnd) {
          trackEndedRef.current = false;
        }

        // A-B リピート（ref 経由で最新値を参照）
        const ab = abRepeatRef.current;
        if (ab.a !== null && ab.b !== null && ab.a < ab.b && currentTime >= ab.b) {
          engine.seek(toAudioAbsoluteTime(ab.a, track, trackDuration));
          setCurrentTime(ab.a);
          return;
        }
        setCurrentTime(currentTime);

        if (reachedTrackEnd) {
          finishCurrentTrack(true);
        }
      },
      onDurationChange: (dur) => {
        const loadedTrack = loadedTrackRef.current;
        setDuration(loadedTrack ? getTrackDuration(loadedTrack.track, dur) : dur);
      },
      onEnded: () => finishCurrentTrack(false),
      onError: (error) => {
        setCoreState((s) => ({ ...s, isPlaying: false, playbackError: error }));
      },
    });
    engineRef.current = engine;

    return () => {
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
      engine.destroy();
    };
  }, [getCurrentPlaybackContext, saveCurrentResume, setCoreState, setCurrentTime, setDuration]);

  // ── トラック変更時に読み込み・再生 ────────────────────────
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const { currentTrackIndex, tracks, currentWork } = coreState;
    if (currentTrackIndex < 0 || currentTrackIndex >= tracks.length || !currentWork) return;

    const track = tracks[currentTrackIndex];
    const workId = currentWork.id;
    const assetUrl = getAudioUrl(workId, track.file);

    // 前トラックの位置を保存
    const prev = loadedTrackRef.current;
    const switchedTrack =
      prev !== null && (prev.workId !== workId || prev.trackIndex !== currentTrackIndex);
    if (switchedTrack) {
      saveCurrentResume(undefined, prev);
    }

    // pending resume の確認
    const pending = pendingResumeRef.current;
    const pendingSeekSec =
      pending?.workId === workId && pending.trackIndex === currentTrackIndex && pending.position > 0
        ? Math.max(
            getTrackStart(track),
            track.end === undefined ? pending.position : Math.min(track.end, pending.position),
          )
        : undefined;

    if (pendingSeekSec !== undefined) {
      pendingResumeRef.current = null;
    }

    const reusesLoadedAsset = switchedTrack && prev.workId === workId && prev.assetUrl === assetUrl;

    loadedTrackRef.current = { workId, trackIndex: currentTrackIndex, track, assetUrl };
    trackEndedRef.current = false;

    if (reusesLoadedAsset) {
      const seekSec = pendingSeekSec ?? getTrackStart(track);
      const trackDuration = getTrackDuration(track, engine.getDuration());
      engine.seek(seekSec);
      setCurrentTime(toTrackRelativeTime(seekSec, track, trackDuration));
      setDuration(trackDuration);

      // 通常のトラック移動では既存の再生状態を保つ。play / playWithResume から
      // isPlaying=true で切り替えられた場合も、再ロードせず再生を開始できる。
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

  // ── 定期 resume 保存 ──────────────────────────────────────
  useEffect(() => {
    if (!coreState.isPlaying || !coreState.currentWork) return;
    const engine = engineRef.current;
    if (!engine) return;

    const workId = coreState.currentWork.id;
    const tid = setInterval(() => {
      const loaded = loadedTrackRef.current;
      if (loaded && loaded.workId === workId) {
        saveCurrentResume();
      }
    }, 5000);
    return () => clearInterval(tid);
  }, [coreState.isPlaying, coreState.currentWork, coreState.currentTrackIndex, saveCurrentResume]);

  // ── 一時停止時に resume 保存 ──────────────────────────────
  useEffect(() => {
    if (coreState.isPlaying || !coreState.currentWork || coreState.currentTrackIndex < 0) return;
    const engine = engineRef.current;
    if (!engine) return;

    const loaded = loadedTrackRef.current;
    if (loaded) {
      saveCurrentResume();
    }
  }, [coreState.isPlaying, coreState.currentWork, coreState.currentTrackIndex, saveCurrentResume]);

  // ── アクション ────────────────────────────────────────────

  const startPlayback = useCallback(
    (work: WorkSummary | Work, tracks: Track[], trackIndex: number) => {
      setCoreState((prev) => ({
        ...prev,
        currentWork: work,
        tracks,
        currentTrackIndex: trackIndex,
        isPlaying: true,
        playbackError: null,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState],
  );

  const play = useCallback(
    (work: WorkSummary | Work, tracks: Track[], trackIndex: number = 0) => {
      pendingResumeRef.current = null;
      startPlayback(work, tracks, trackIndex);
    },
    [startPlayback],
  );

  const playWithResume = useCallback(
    (work: Work) => {
      const playlist =
        work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default")) ??
        work.playlists[0];
      const tracks = playlist?.tracks ?? [];
      if (tracks.length === 0) return;

      const trackIndex = Math.min(work.resumeTrackIndex, tracks.length - 1);

      if (work.resumePosition > 0) {
        pendingResumeRef.current = { workId: work.id, trackIndex, position: work.resumePosition };
      }

      startPlayback(work, tracks, trackIndex);
    },
    [startPlayback],
  );

  const togglePlay = useCallback(() => {
    if (coreState.isPlaying) {
      engineRef.current?.pause();
    } else {
      engineRef.current?.play();
    }
  }, [coreState.isPlaying]);

  const stop = useCallback(() => {
    const engine = engineRef.current;
    saveCurrentResume();
    engine?.pause();
    engine?.seek(0);
    loadedTrackRef.current = null;
    pendingResumeRef.current = null;
    setCoreState((prev) => ({
      ...prev,
      isPlaying: false,
      currentTrackIndex: -1,
      currentWork: null,
      tracks: [],
      playbackError: null,
    }));
  }, [saveCurrentResume, setCoreState]);

  const seek = useCallback(
    (time: number) => {
      const context = getCurrentPlaybackContext();
      if (!context) return;
      context.engine.seek(toAudioAbsoluteTime(time, context.track, context.trackDuration));
    },
    [getCurrentPlaybackContext],
  );
  const seekRelative = useCallback(
    (delta: number) => {
      const context = getCurrentPlaybackContext();
      if (!context) return;
      context.engine.seek(
        toAudioAbsoluteTime(context.currentTime + delta, context.track, context.trackDuration),
      );
    },
    [getCurrentPlaybackContext],
  );

  const setVolume = useCallback(
    (vol: number) => {
      engineRef.current?.setVolume(vol);
      setCoreState((prev) => ({ ...prev, volume: Math.max(0, Math.min(100, vol)) }));
    },
    [setCoreState],
  );

  // ミュート前の音量を覚えておき、解除時に復元する。
  const lastVolumeRef = useRef(coreState.volume || 75);
  const toggleMute = useCallback(() => {
    setCoreState((prev) => {
      if (prev.volume > 0) {
        lastVolumeRef.current = prev.volume;
        engineRef.current?.setVolume(0);
        return { ...prev, volume: 0 };
      }
      const restored = lastVolumeRef.current || 75;
      engineRef.current?.setVolume(restored);
      return { ...prev, volume: restored };
    });
  }, [setCoreState]);

  const setLoop = useCallback(
    (loop: boolean) => {
      setCoreState((prev) => ({ ...prev, loop }));
    },
    [setCoreState],
  );

  const nextTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex < prev.tracks.length - 1) {
        return {
          ...prev,
          currentTrackIndex: prev.currentTrackIndex + 1,
          abRepeat: { a: null, b: null },
        };
      }
      return prev;
    });
  }, [setCoreState]);

  const prevTrack = useCallback(() => {
    setCoreState((prev) => {
      if (prev.currentTrackIndex > 0) {
        return {
          ...prev,
          currentTrackIndex: prev.currentTrackIndex - 1,
          abRepeat: { a: null, b: null },
        };
      }
      return prev;
    });
  }, [setCoreState]);

  const setTrackIndex = useCallback(
    (index: number) => {
      setCoreState((prev) => ({
        ...prev,
        currentTrackIndex: index,
        abRepeat: { a: null, b: null },
      }));
    },
    [setCoreState],
  );

  const setShowFullPlayer = useCallback(
    (show: boolean) => {
      setCoreState((prev) => ({ ...prev, showFullPlayer: show }));
    },
    [setCoreState],
  );

  const setPlaybackRate = useCallback(
    (rate: number) => {
      engineRef.current?.setPlaybackRate(rate);
      setCoreState((prev) => ({ ...prev, playbackRate: rate }));
    },
    [setCoreState],
  );

  const setChannelSwap = useCallback(
    (enabled: boolean) => {
      engineRef.current?.setChannelSwap(enabled);
      setCoreState((prev) => ({ ...prev, channelSwap: enabled }));
    },
    [setCoreState],
  );

  const setABPoint = useCallback(
    (point: "a" | "b") => {
      const time = getCurrentPlaybackContext()?.currentTime ?? 0;
      setCoreState((prev) => {
        const next = { ...prev.abRepeat, [point]: time };
        // B→A の順で設定して区間が逆転した場合は入れ替えて成立させる
        if (next.a !== null && next.b !== null && next.a > next.b) {
          return { ...prev, abRepeat: { a: next.b, b: next.a } };
        }
        return { ...prev, abRepeat: next };
      });
    },
    [getCurrentPlaybackContext, setCoreState],
  );

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
    toggleMute,
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
