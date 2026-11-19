import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { updateCachesAfterDlsiteFetch } from "../../../entities/work/model/workCacheUpdates";
import { useDlsiteJobState, useDlsiteJobStore } from "../../../entities/dlsite/useDlsiteJob";
import { useToast } from "../../../shared/ui/useToast";

/** コードが終端に達するたびの候補一覧の取り直しを間引く間隔（末尾実行） */
export const DLSITE_CANDIDATES_REFRESH_INTERVAL_MS = 3000;

// DLsite取得ジョブの追跡（dlsiteJobStore）を、キャッシュ更新とエラートーストへつなぐ。
// 状態は購読しない（進捗でAppを再描画しない）。
export default function DlsiteJobRuntime() {
  const queryClient = useQueryClient();
  const dlsiteJob = useDlsiteJobStore();
  const errorToast = useToast();
  const error = useDlsiteJobState((state) => state.error);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const clearTimer = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    const unsubscribe = dlsiteJob.subscribeEvents((event) => {
      if (event.type === "codesTerminal") {
        if (timer !== null) return;
        timer = setTimeout(() => {
          timer = null;
          void refreshScanCandidates(queryClient).catch(() => {});
        }, DLSITE_CANDIDATES_REFRESH_INTERVAL_MS);
        return;
      }
      clearTimer();
      void Promise.allSettled([
        refreshScanCandidates(queryClient),
        updateCachesAfterDlsiteFetch(queryClient, event.productCodes),
      ]).then(() => dlsiteJob.markSettled(event.jobId));
    });
    return () => {
      unsubscribe();
      clearTimer();
    };
  }, [dlsiteJob, queryClient]);

  useEffect(() => {
    void dlsiteJob.attach();
    return () => dlsiteJob.reset();
  }, [dlsiteJob]);

  useEffect(() => {
    if (!error) {
      errorToast.dismiss();
      return;
    }
    errorToast.show({
      message: error,
      variant: "error",
      priority: "notice",
      onDismiss: () => dlsiteJob.clearError(),
    });
  }, [error, errorToast, dlsiteJob]);

  return null;
}
