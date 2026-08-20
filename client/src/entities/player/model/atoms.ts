// player の Jotai atoms。
//
// 設計方針（issue参照）:
//   - playerCoreAtom: position を除く core フィールド（isPlaying / currentWork / tracks 等）
//     usePlayerRuntime の投影で意味的同一なら参照を維持するため timeupdate では更新されない
//     → PlayerDock など state 全体が必要な leaf で subscribe する
//   - 派生 atom: TopBar / LeftNav など一部の値だけ必要な購読者向け
//   - playerCurrentTimeAtom / playerDurationAtom: timeupdate ごとに更新される高頻度 state
//     → usePlaybackProgress hook 経由で BarSeekStrip / PopupSeek / FullScreenScrub の
//       3 leaf のみが subscribe する（親の BarContent / PopupContent / FullScreenPlayer は購読しない）
//
// currentTime / duration は PlayerState の型には残さず、atom からのみ読む。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { PLAYER_CORE_INITIAL, type PlayerCoreState } from "./playerCoreState";

export { PLAYER_CORE_INITIAL, type PlayerCoreState } from "./playerCoreState";

export const playerCoreAtom = atom<PlayerCoreState>(PLAYER_CORE_INITIAL);

export const playerIsActiveAtom = atom((get) => {
  const state = get(playerCoreAtom);
  return state.currentTrackIndex >= 0 && (state.currentWork !== null || state.isFilePlayback);
});

export const playerIsPlayingOrLoadingAtom = atom((get) => get(playerCoreAtom).isPlaying);

export const playingWorkIdAtom = atom((get) => get(playerCoreAtom).currentWork?.id);

export const playingTrackIndexAtom = atom((get) => get(playerCoreAtom).currentTrackIndex);

export const playingTrackTitleAtom = atom((get) => {
  const state = get(playerCoreAtom);
  if (state.currentTrackIndex < 0) return undefined;
  return state.tracks[state.currentTrackIndex]?.title;
});

export const playingFsPathAtom = atom((get) => {
  const state = get(playerCoreAtom);
  if (!state.isFilePlayback || state.currentTrackIndex < 0) return null;
  return state.tracks[state.currentTrackIndex]?.file ?? null;
});

export const playingTrackRelPathAtom = atom((get) => {
  const state = get(playerCoreAtom);
  if (state.isFilePlayback || state.currentTrackIndex < 0) return null;
  return state.tracks[state.currentTrackIndex]?.file ?? null;
});

export type PlayerUiMode = "bar" | "popup";

/**
 * 画面下張り付きバー / 右下ポップアップのどちらを使っていたか。
 * localStorage に永続化し、次回再生時に復元する（issue参照）。
 */
export const playerUiModeAtom = atomWithStorage<PlayerUiMode>("mimimilli:playerUiMode", "bar");

export const dockedBarActiveAtom = atom(
  (get) => get(playerIsActiveAtom) && get(playerUiModeAtom) === "bar",
);

/** ポップアップの初期位置（右下）からのドラッグ移動オフセット（px）。 */
export interface PlayerPopupOffset {
  x: number;
  y: number;
}

export const PLAYER_POPUP_OFFSET_INITIAL: PlayerPopupOffset = { x: 0, y: 0 };

/**
 * 再生ポップアップの初期位置からのドラッグ移動オフセット。localStorage に永続化し、
 * リロード後も維持する。motion value の初期値としてマウント時に一度だけ読まれるため
 * getOnInit で同期読み込みする（既定の遅延読み込みだと初回描画に間に合わない）。
 */
export const playerPopupOffsetAtom = atomWithStorage<PlayerPopupOffset>(
  "mimimilli:playerPopupOffset",
  PLAYER_POPUP_OFFSET_INITIAL,
  undefined,
  { getOnInit: true },
);

/**
 * 高頻度更新の audio 再生時刻（秒）。
 * usePlaybackProgress 経由で BarSeekStrip / PopupSeek / FullScreenScrub のみ subscribe すること。
 */
export const playerCurrentTimeAtom = atom(0);

/**
 * 高頻度更新の audio 総時間（秒）。
 * usePlaybackProgress 経由で BarSeekStrip / PopupSeek / FullScreenScrub のみ subscribe すること。
 */
export const playerDurationAtom = atom<number | null>(0);
