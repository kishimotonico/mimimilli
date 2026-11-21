import { useStore } from "jotai";
import { useStoreSelector } from "../../shared/lib/useStoreSelector";
import { isScanning, scanJobStoreAtom, type ScanJobState } from "./model/scanJobStore";

export function useScanJobStore() {
  return useStore().get(scanJobStoreAtom);
}

export function useScanJobState<T>(selector: (state: ScanJobState) => T): T {
  return useStoreSelector(useScanJobStore(), selector);
}

const selectScanning = isScanning;

export const useScanning = () => useScanJobState(selectScanning);
