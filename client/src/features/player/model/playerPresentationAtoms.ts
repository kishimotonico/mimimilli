// player の表示・シェル状態（UI モード・ポップアップ位置等）の Jotai atoms。
// core・progress・再生対象selectorは entities/player 側にある。

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { playerIsActiveAtom } from "../../../entities/player/model/atoms";

export type PlayerUiMode = "bar" | "popup";

/**
 * 画面下張り付きバー / 右下ポップアップのどちらを使っていたか。
 * localStorage に永続化し、次回再生時に復元する（issue参照）。
 */
export const playerUiModeAtom = atomWithStorage<PlayerUiMode>("mimimilli:playerUiMode", "bar");

/**
 * 再生中で uiMode が bar のとき、画面下張り付きバーが表示される。
 * 再生中タブ（appMode）による抑制は AppShell / AppBody 側の合成に任せる。
 */
export const playerDockBarVisibleAtom = atom(
  (get) => get(playerIsActiveAtom) && get(playerUiModeAtom) === "bar",
);

/**
 * 再生中で uiMode が popup のとき、右下ポップアップが表示される。
 * 再生中タブ（appMode）による抑制は AppShell / AppBody 側の合成に任せる。
 */
export const playerDockPopupVisibleAtom = atom(
  (get) => get(playerIsActiveAtom) && get(playerUiModeAtom) === "popup",
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

/** オフセットが初期位置のままか（ドラッグで動かされていないか）。 */
export const playerPopupAtOriginAtom = atom((get) => {
  const offset = get(playerPopupOffsetAtom);
  return offset.x === 0 && offset.y === 0;
});

/**
 * ポップアップの実測高さ（px）。ResizeObserver（usePopupDrag）が随時更新する。
 * 未表示時・測定前は0で、その間 has-docked-popup は付与されないため参照されない。
 */
export const playerPopupMeasuredHeightAtom = atom(0);

export type NowPlayingViewMode = "normal" | "immersive";

/** 再生中タブの表示モード。localStorage に永続化し、次回もそのモードで開く。 */
export const nowPlayingViewModeAtom = atomWithStorage<NowPlayingViewMode>(
  "mimimilli:nowPlayingViewMode",
  "normal",
);

/** 壊れたトラックをスキップしたときの一時通知。GlobalToast が表示する。 */
export interface PlayerSkipToast {
  message: string;
  /** スキップされたトラックのindex。「このトラックを再試行」からの trackSelected 用。 */
  trackIndex: number;
}

export const playerSkipToastAtom = atom<PlayerSkipToast | null>(null);
