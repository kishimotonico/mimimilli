import { useStore } from "jotai";
import { useStoreSelector } from "../../shared/lib/useStoreSelector";
import { isScanning, scanJobStoreAtom, type ScanJobState } from "./model/scanJobStore";
import { formatScanProgressLabel } from "./model/scanProgressLabel";

export function useScanJobStore() {
  return useStore().get(scanJobStoreAtom);
}

export function useScanJobState<T>(selector: (state: ScanJobState) => T): T {
  return useStoreSelector(useScanJobStore(), selector);
}

const selectScanning = isScanning;
const selectScanProgress = (state: ScanJobState) => state.job?.progress ?? null;
const selectScanProgressLabel = (state: ScanJobState) =>
  formatScanProgressLabel(selectScanProgress(state));

export const useScanning = () => useScanJobState(selectScanning);
export const useScanProgress = () => useScanJobState(selectScanProgress);
export const useScanProgressLabel = () => useScanJobState(selectScanProgressLabel);
