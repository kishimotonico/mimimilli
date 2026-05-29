// player feature の Jotai atoms。
//
// 設計方針（issue参照）:
//   - playerCoreAtom: isPlaying / currentWork / tracks 等の低頻度 state
//     → App.tsx や LeftNav など広い範囲が subscribe してもコストが低い
//   - playerCurrentTimeAtom / playerDurationAtom: timeupdate ごとに更新される高頻度 state
//     → TransportBar と FullScreenPlayer のみが subscribe する
//     → App.tsx は subscribe しないため、再生中に不要な re-render が起きない
//
// currentTime / duration は PlayerState の型には残さず、atom からのみ読む。

import { atom } from "jotai";
import type { Track, WorkSummary, Work } from "../../../entities/work/model";

export interface PlayerCoreState {
  isPlaying: boolean;
  currentTrackIndex: number;
  currentWork: WorkSummary | Work | null;
  tracks: Track[];
  volume: number;
  loop: boolean;
  showFullPlayer: boolean;
  playbackRate: number;
  channelSwap: boolean;
  abRepeat: { a: number | null; b: number | null };
}

export const PLAYER_CORE_INITIAL: PlayerCoreState = {
  isPlaying: false,
  currentTrackIndex: -1,
  currentWork: null,
  tracks: [],
  volume: 75,
  loop: false,
  showFullPlayer: false,
  playbackRate: 1.0,
  channelSwap: false,
  abRepeat: { a: null, b: null },
};

/** 低頻度更新の player core state */
export const playerCoreAtom = atom<PlayerCoreState>(PLAYER_CORE_INITIAL);

/**
 * 高頻度更新の audio 再生時刻（秒）。
 * TransportBar / FullScreenPlayer のみ subscribe すること。
 */
export const playerCurrentTimeAtom = atom(0);

/**
 * 高頻度更新の audio 総時間（秒）。
 * TransportBar / FullScreenPlayer のみ subscribe すること。
 */
export const playerDurationAtom = atom(0);
