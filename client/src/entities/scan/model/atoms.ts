// スキャンジョブの Jotai atoms。
// SSE 購読は ScanRuntime が単一所有者。表示側は必要な atom だけ subscribe する。

import { atom } from "jotai";
import type { ScanJobSnapshot, StartScanRequest } from "@mimimilli/shared";
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

export const scanErrorAtom = atom<string | null>(null);

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
