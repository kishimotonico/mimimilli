// スキャンジョブの Jotai atoms。
// SSE 購読は ScanRuntime が単一所有者。表示側は必要な atom だけ subscribe する。

import { atom } from "jotai";
import type { ScanJobSnapshot, StartScanRequest } from "@mimimilli/shared";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";
import { formatScanProgressLabel, type ScanProgress } from "./scanProgressLabel";
import { isTerminalScanJob } from "./scanJob";

export const scanJobAtom = atom<ScanJobSnapshot | null>(null);

export const scanningAtom = atom((get) => {
  const job = get(scanJobAtom);
  return job !== null && !isTerminalScanJob(job);
});

export const scanProgressAtom = atom<ScanProgress | null>((get) => {
  const job = get(scanJobAtom);
  return job?.progress ?? null;
});

export const scanProgressLabelAtom = atom((get) => formatScanProgressLabel(get(scanProgressAtom)));

/** ScanModal がマウント中かどうか。activeModalAtomから導出する（読み取り専用） */
export const scanModalOpenAtom = atom((get) => get(activeModalAtom)?.kind === "scan");

export type ScanActionResult =
  | { ok: true; job: ScanJobSnapshot | null }
  | { ok: false; error: string };

export interface ScanActions {
  start: (options?: StartScanRequest) => Promise<ScanActionResult>;
  cancel: () => Promise<ScanActionResult>;
  clearError: () => void;
}

/** ScanRuntime がマウント時に登録する操作群。未配線時は null */
export const scanActionsAtom = atom<ScanActions | null>(null);

/** 未登録候補のうち、承認・除外操作でローカルに非表示にしたpath。サーバー由来のcandidatesクエリとは独立に持ち、
 *  再取得のタイミングに関わらず巻き戻らないようにする。 */
export const scanCandidateHiddenPathsAtom = atom<ReadonlySet<string>>(new Set<string>());
