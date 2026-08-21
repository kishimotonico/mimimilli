// player の Jotai atoms。
//
// 設計方針（issue参照）:
//   - playerCoreAtom: position を除く core フィールド（isPlaying / currentWork / tracks 等）
//     usePlayerRuntime の投影で意味的同一なら参照を維持するため timeupdate では更新されない
//     → PlayerDock など state 全体が必要な leaf で subscribe する
//   - 派生 atom: TopBar / LeftNav など一部の値だけ必要な購読者向け
//   - playerCurrentTimeAtom / playerDurationAtom: timeupdate ごとに更新される高頻度 state
//     → usePlaybackProgress hook 経由で BarSeekStrip / PopupSeek / NowPlayingScrub の
//       3 leaf のみが subscribe する（親の BarContent / PopupContent / NowPlayingView は購読しない）
//
// currentTime / duration は PlayerState の型には残さず、atom からのみ読む。

import { atom } from "jotai";
import { isPlayerActive, PLAYER_CORE_INITIAL, type PlayerCoreState } from "./playerCoreState";

export { PLAYER_CORE_INITIAL, type PlayerCoreState } from "./playerCoreState";

export const playerCoreAtom = atom<PlayerCoreState>(PLAYER_CORE_INITIAL);

export const playerIsActiveAtom = atom((get) => isPlayerActive(get(playerCoreAtom)));

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

/**
 * 高頻度更新の audio 再生時刻（秒）。
 * usePlaybackProgress 経由で BarSeekStrip / PopupSeek / NowPlayingScrub のみ subscribe すること。
 */
export const playerCurrentTimeAtom = atom(0);

/**
 * 高頻度更新の audio 総時間（秒）。
 * usePlaybackProgress 経由で BarSeekStrip / PopupSeek / NowPlayingScrub のみ subscribe すること。
 */
export const playerDurationAtom = atom<number | null>(0);
