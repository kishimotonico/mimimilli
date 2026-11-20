import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
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
    /** まとめてのコードは、取得中の一覧を取り直し続けないよう、ジョブの終わりでまとめて無効化する */
    const pendingBulk = new Set<string>();
    const invalidate = (codes: readonly string[]) =>
      void updateCachesAfterDlsiteFetch(queryClient, codes).catch(() => {});
    const unsubscribe = dlsiteJob.subscribeEvents((event) => {
      if (event.type === "jobEnded") {
        if (pendingBulk.size > 0) invalidate([...pendingBulk]);
        pendingBulk.clear();
        return;
      }
      const single: string[] = [];
      for (const { code, origin } of event.codes) {
        if (origin === "single") single.push(code);
        else pendingBulk.add(code);
      }
      if (single.length > 0) invalidate(single);
      if (event.codes.some(({ known }) => !known)) {
        void refreshScanCandidates(queryClient).catch(() => {});
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
