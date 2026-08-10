// DLsite 一括取得ジョブの Jotai atoms。
// SSE 購読は DlsiteBulkRuntime が単一所有者。表示側は必要な atom だけ subscribe する。

import { atom } from "jotai";
import type { DlsiteBulkResult } from "@mimimilli/shared";

export const dlsiteBulkActiveAtom = atom(false);

/** POST /dlsite/bulk の応答待ち。active になる前の多重開始を防ぐ */
export const dlsiteBulkStartingAtom = atom(false);

export const dlsiteBulkCancellingAtom = atom(false);

export const dlsiteBulkProgressAtom = atom<{ processed: number; total: number } | null>(null);

export const dlsiteBulkResultAtom = atom<DlsiteBulkResult | null>(null);

export const dlsiteBulkCancelledResultAtom = atom<DlsiteBulkResult | null>(null);

export const dlsiteBulkErrorAtom = atom<string | null>(null);

export interface DlsiteBulkActions {
  start: () => Promise<void>;
  attach: () => void;
  cancel: () => Promise<void>;
  dismiss: () => void;
}

/** DlsiteBulkRuntime がマウント時に登録する操作群。未配線時は null */
export const dlsiteBulkActionsAtom = atom<DlsiteBulkActions | null>(null);

export type DlsiteInvalidate = (workIds?: string | string[]) => Promise<void>;

/** DlsiteBulkRuntime がマウント時に登録するキャッシュ無効化。未配線時は null */
export const dlsiteInvalidateAtom = atom<DlsiteInvalidate | null>(null);
