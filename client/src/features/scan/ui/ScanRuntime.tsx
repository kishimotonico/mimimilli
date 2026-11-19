import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { useEffect } from "react";
import { SETTINGS_QUERY_KEYS } from "../../../entities/settings/queryKeys";
import { SCAN_QUERY_KEYS } from "../api";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { updateCachesAfterLibraryScan } from "../../../entities/work/model/workCacheUpdates";
import { scanModalOpenAtom } from "../../../entities/scan/model/atoms";
import { useScanJobState, useScanJobStore } from "../../../entities/scan/useScanJob";
import { useToast } from "../../../shared/ui/useToast";

// スキャンジョブ（scanJobStore）の終端・開始イベントとエラー状態を、トースト・キャッシュ更新へつなぐ。
export default function ScanRuntime() {
  const queryClient = useQueryClient();
  const jotaiStore = useStore();
  const scanJob = useScanJobStore();
  // dismiss()は発行元（useToastの呼び出し）単位でしか効かないため、終了通知用とエラー用で分ける。
  const terminalToast = useToast();
  const errorToast = useToast();
  const error = useScanJobState((state) => state.error);

  useEffect(
    () =>
      scanJob.subscribeEvents((event) => {
        if (event.type === "started") return;
        const job = event.job;
        // モーダルが開いている間はサイドバーの表示が中止を知らせるため、トーストは重ねない。
        const scanModalOpen = jotaiStore.get(scanModalOpenAtom);
        if (job.status === "cancelled") {
          // 終了通知を出すのと同じ同期経路でエラー要求を取り下げる
          errorToast.dismiss();
          if (!scanModalOpen) {
            terminalToast.show({
              message: "スキャンを中止しました",
              variant: "warning",
              priority: "notice",
            });
          }
          return;
        }
        if (job.status !== "completed") return;
        errorToast.dismiss();
        void updateCachesAfterLibraryScan(queryClient);
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      }),
    [errorToast, jotaiStore, queryClient, scanJob, terminalToast],
  );

  // 候補は明示的な取得でしか更新されないため、アプリ起動時に一度取得して未登録バッジを揃える。
  useEffect(() => {
    if (queryClient.getQueryData(SCAN_QUERY_KEYS.candidates()) !== undefined) return;
    void refreshScanCandidates(queryClient).catch(() => {});
  }, [queryClient]);

  // リロード後も実行中のジョブへ再接続する
  useEffect(() => {
    void scanJob.attach();
    return () => scanJob.reset();
  }, [scanJob]);

  useEffect(() => {
    if (!error) {
      errorToast.dismiss();
      return;
    }
    errorToast.show({
      message: error,
      variant: "error",
      priority: "notice",
      onDismiss: () => scanJob.clearError(),
    });
  }, [error, errorToast, scanJob]);

  return null;
}
