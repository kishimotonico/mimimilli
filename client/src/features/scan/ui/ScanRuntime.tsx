import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "jotai";
import { useEffect } from "react";
import { SETTINGS_QUERY_KEYS } from "../../../entities/settings/queryKeys";
import { SCAN_QUERY_KEYS } from "../api";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { updateCachesAfterLibraryScan } from "../../../entities/work/model/workCacheUpdates";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";
import { scanRecordQueryOptions } from "../../../entities/scan/queryOptions";
import { scanNewCountQueryOptions } from "../../../entities/work/scanNewCountQueryOptions";
import { composeScanChanges, scanChangesKeys, scanChangesMessage } from "../model/scanChanges";
import { nextSeen, scanEntrySeenAtom } from "../model/scanEntrySeen";
import { SCAN_FAILED_FALLBACK_REASON } from "../model/scanStatusView";
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
  const failureToast = useToast();
  const error = useScanJobState((state) => state.error);

  useEffect(
    () =>
      scanJob.subscribeEvents((event) => {
        if (event.type === "started") {
          errorToast.dismiss();
          failureToast.dismiss();
          terminalToast.dismiss();
          return;
        }
        const job = event.job;
        // モーダルが開いている間は、終端の種別をサイドバーの状態欄が知らせる。
        const scanModalOpen = () => jotaiStore.get(scanModalOpenAtom);
        const openModal = () => jotaiStore.set(activeModalAtom, { kind: "scan" });
        errorToast.dismiss();
        failureToast.dismiss();
        if (job.status === "cancelled") {
          if (!scanModalOpen()) {
            terminalToast.show({
              message: "スキャンを中止しました",
              variant: "info",
              priority: "notice",
              actionLabel: "開く",
              onAction: openModal,
            });
          }
          return;
        }
        if (job.status === "failed") {
          if (!scanModalOpen()) {
            failureToast.show({
              message: `スキャンできませんでした（${job.error ?? SCAN_FAILED_FALLBACK_REASON}）`,
              variant: "error",
              priority: "notice",
              actionLabel: "開く",
              onAction: openModal,
            });
          }
          return;
        }
        if (job.status !== "completed") return;
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
        const openedAtFinish = scanModalOpen();
        void (async () => {
          await updateCachesAfterLibraryScan(queryClient);
          const changes = await Promise.all([
            queryClient.fetchQuery({
              ...scanRecordQueryOptions,
              staleTime: Number.POSITIVE_INFINITY,
            }),
            queryClient.fetchQuery({
              ...scanNewCountQueryOptions,
              staleTime: Number.POSITIVE_INFINITY,
            }),
          ])
            .then(([record, newCount]) => composeScanChanges(record, newCount))
            .catch(() => null);
          // 終端を見ていたあいだに開いて閉じたときも、見た扱いにする。
          if (changes && (openedAtFinish || scanModalOpen())) {
            jotaiStore.set(scanEntrySeenAtom, (seen) =>
              nextSeen(seen, {
                candidates: null,
                needsAttention: null,
                changes: scanChangesKeys(changes),
              }),
            );
          }
          if (openedAtFinish || scanModalOpen()) return;
          if (scanJob.getState().job?.id !== job.id) return;
          terminalToast.show({
            message: changes ? scanChangesMessage(changes) : "スキャン完了",
            variant: "success",
            priority: "notice",
            actionLabel: "開く",
            onAction: openModal,
          });
        })();
      }),
    [errorToast, failureToast, jotaiStore, queryClient, scanJob, terminalToast],
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
