import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { refreshScanCandidatesQuietly } from "../../../entities/scan/scanCandidatesCache";
import { updateCachesAfterDlsiteFetch } from "../../../entities/work/model/workCacheUpdates";
import { useDlsiteJobState, useDlsiteJobStore } from "../../../entities/dlsite/useDlsiteJob";
import { useToast } from "../../../shared/ui/useToast";

// DLsite取得ジョブの追跡（dlsiteJobStore）を、キャッシュ更新とエラートーストへつなぐ。
// 状態は購読しない（進捗でAppを再描画しない）。
export default function DlsiteJobRuntime() {
  const queryClient = useQueryClient();
  const dlsiteJob = useDlsiteJobStore();
  const errorToast = useToast();
  const error = useDlsiteJobState((state) => state.error);

  useEffect(() => {
    /** 取得中の一覧を取り直し続けないよう、ジョブの終わりでまとめて無効化する */
    const pending = new Set<string>();
    const unsubscribe = dlsiteJob.subscribeEvents((event) => {
      if (event.type === "jobEnded") {
        if (pending.size > 0) {
          void updateCachesAfterDlsiteFetch(queryClient, [...pending]).catch(() => {});
        }
        pending.clear();
        return;
      }
      for (const { code } of event.codes) pending.add(code);
      if (event.codes.some(({ known }) => !known)) {
        void refreshScanCandidatesQuietly(queryClient);
      }
    });
    return unsubscribe;
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
