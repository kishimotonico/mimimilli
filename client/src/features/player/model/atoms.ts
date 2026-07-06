// player feature の Jotai atoms。
//
// 設計方針（issue参照）:
//   - playerCoreAtom: isPlaying / currentWork / tracks 等の低頻度 state
//     → App.tsx や LeftNav など広い範囲が subscribe してもコストが低い
//   - playerCurrentTimeAtom / playerDurationAtom: timeupdate ごとに更新される高頻度 state
//     → BarContent / PopupContent / FullScreenPlayer のみが subscribe する
//     → App.tsx は subscribe しないため、再生中に不要な re-render が起きない
//
// currentTime / duration は PlayerState の型には残さず、atom からのみ読む。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Track, WorkSummary, Work } from "../../../entities/work/model";
import type { AudioEngineError } from "./audioEngine";

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
  playbackError: AudioEngineError | null;
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
  playbackError: null,
};

/** 低頻度更新の player core state */
export const playerCoreAtom = atom<PlayerCoreState>(PLAYER_CORE_INITIAL);

/**
 * 高頻度更新の audio 再生時刻（秒）。
 * BarContent / PopupContent / FullScreenPlayer のみ subscribe すること。
 */
export const playerCurrentTimeAtom = atom(0);

/**
 * 高頻度更新の audio 総時間（秒）。
 * BarContent / PopupContent / FullScreenPlayer のみ subscribe すること。
 */
export const playerDurationAtom = atom(0);

export type PlayerUiMode = "bar" | "popup";

/**
 * 画面下張り付きバー / 右下ポップアップのどちらを使っていたか。
 * localStorage に永続化し、次回再生時に復元する（issue参照）。
 */
export const playerUiModeAtom = atomWithStorage<PlayerUiMode>("mimimilli:playerUiMode", "bar");
