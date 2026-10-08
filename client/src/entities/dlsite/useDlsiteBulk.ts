import { useStore } from "jotai";
import { useStoreSelector } from "../../shared/lib/useStoreSelector";
import { dlsiteBulkStoreAtom, type DlsiteBulkState } from "./model/dlsiteBulkStore";
import {
  formatDlsiteBulkProgressLabel,
  formatDlsiteBulkWorkLabel,
} from "./model/dlsiteProgressLabel";

export function useDlsiteBulkStore() {
  return useStore().get(dlsiteBulkStoreAtom);
}

export function useDlsiteBulkState<T>(selector: (state: DlsiteBulkState) => T): T {
  return useStoreSelector(useDlsiteBulkStore(), selector);
}

const selectActive = (state: DlsiteBulkState) => state.jobId !== null;
const selectStarting = (state: DlsiteBulkState) => state.starting;
const selectCancelling = (state: DlsiteBulkState) => state.cancelling;
const selectProgress = (state: DlsiteBulkState) => state.progress;
const selectProgressLabel = (state: DlsiteBulkState) =>
  formatDlsiteBulkProgressLabel(state.progress);
/** タイトル未設定ならRJ番号にフォールバックした、現在処理中の作品の表示名 */
const selectCurrentWorkLabel = (state: DlsiteBulkState) =>
  formatDlsiteBulkWorkLabel(state.progress?.work ?? null) ?? null;

export const useDlsiteBulkActive = () => useDlsiteBulkState(selectActive);
export const useDlsiteBulkStarting = () => useDlsiteBulkState(selectStarting);
export const useDlsiteBulkCancelling = () => useDlsiteBulkState(selectCancelling);
export const useDlsiteBulkProgress = () => useDlsiteBulkState(selectProgress);
export const useDlsiteBulkProgressLabel = () => useDlsiteBulkState(selectProgressLabel);
export const useDlsiteBulkCurrentWorkLabel = () => useDlsiteBulkState(selectCurrentWorkLabel);
