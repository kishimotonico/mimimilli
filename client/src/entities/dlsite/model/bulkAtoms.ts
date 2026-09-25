// DLsite 一括取得ジョブの Jotai atoms。
// SSE 購読は DlsiteBulkRuntime が単一所有者。表示側は必要な atom だけ subscribe する。
// 完了・中断・エラーの通知はここに atom を持たず、DlsiteBulkRuntime が useToast で直接出す。

import { atom } from "jotai";
import type { DlsiteBulkProgressSnapshot } from "@mimimilli/shared";
import { formatDlsiteBulkProgressLabel, formatDlsiteBulkWorkLabel } from "./dlsiteProgressLabel";

/** DlsiteBulkRuntime が追跡中の一括取得ジョブのID */
export const dlsiteBulkJobIdAtom = atom<string | null>(null);

export const dlsiteBulkActiveAtom = atom((get) => get(dlsiteBulkJobIdAtom) !== null);

/** POST /dlsite/bulk の応答待ち。active になる前の多重開始を防ぐ */
export const dlsiteBulkStartingAtom = atom(false);

export const dlsiteBulkCancellingAtom = atom(false);

export const dlsiteBulkProgressAtom = atom<DlsiteBulkProgressSnapshot | null>(null);

export const dlsiteBulkProgressLabelAtom = atom((get) =>
  formatDlsiteBulkProgressLabel(get(dlsiteBulkProgressAtom)),
);

/** 現在処理中の作品の表示名。タイトル未設定ならRJ番号にフォールバックする */
export const dlsiteBulkCurrentWorkLabelAtom = atom(
  (get) => formatDlsiteBulkWorkLabel(get(dlsiteBulkProgressAtom)?.work ?? null) ?? null,
);

export const dlsiteBulkApplyOpenAtom = atom(false);

export const dlsiteBulkApplyBusyAtom = atom(false);

export interface DlsiteBulkActions {
  start: () => Promise<void>;
  attach: () => void;
  cancel: () => Promise<void>;
}

/** DlsiteBulkRuntime がマウント時に登録する操作群。未配線時は null */
export const dlsiteBulkActionsAtom = atom<DlsiteBulkActions | null>(null);
