import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useSetAtom, useStore } from "jotai";
import { useEffect } from "react";
import type { ScanResult } from "@mimimilli/shared";
import { SETTINGS_QUERY_KEYS } from "../../../entities/settings/queryKeys";
import { useDlsiteBulkStore } from "../../../entities/dlsite/useDlsiteBulk";
import { SCAN_QUERY_KEYS } from "../api";
import { scanDiagnosticsQueryOptions } from "../../../entities/scan/queryOptions";
import { dlsiteNotificationSummaryQueryOptions } from "../../../entities/dlsite/model/dlsiteNotificationSummaryQueryOptions";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { updateCachesAfterLibraryScan } from "../../../entities/work/model/workCacheUpdates";
import {
  scanCandidateHiddenPathsAtom,
  scanModalOpenAtom,
} from "../../../entities/scan/model/atoms";
import { useScanJobState, useScanJobStore } from "../../../entities/scan/useScanJob";
import { formatScanResult } from "../model/formatScanResult";
import { activeModalAtom } from "../../../shared/model/activeModalAtom";
import { useToast } from "../../../shared/ui/useToast";

/** 要対応の有無は実行結果ではなく完了直後の現在の診断で判定する。取得に失敗したら要対応リンクを出さない。 */
async function showCompletionToast(queryClient: QueryClient, result: ScanResult): Promise<boolean> {
  try {
    const [diagnostics, notificationSummary] = await Promise.all([
      queryClient.fetchQuery({ ...scanDiagnosticsQueryOptions, staleTime: 0 }),
      queryClient.fetchQuery({ ...dlsiteNotificationSummaryQueryOptions, staleTime: 0 }),
    ]);
    return (
      diagnostics.identityConflicts.length > 0 ||
      diagnostics.invalidMetaFiles.length > 0 ||
      notificationSummary.rjCodeMissingCount > 0 ||
      result.dataIntegrityWarning !== undefined
    );
  } catch {
    return result.dataIntegrityWarning !== undefined;
  }
}

// スキャンジョブ（scanJobStore）の終端・開始イベントとエラー状態を、トースト・キャッシュ更新へつなぐ。
export default function ScanRuntime() {
  const queryClient = useQueryClient();
  const jotaiStore = useStore();
  const scanJob = useScanJobStore();
  const dlsiteBulk = useDlsiteBulkStore();
  const setHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const setActiveModal = useSetAtom(activeModalAtom);
  // dismiss()は発行元（useToastの呼び出し）単位でしか効かないため、終了通知用とエラー用で分ける。
  const terminalToast = useToast();
  const errorToast = useToast();
  const error = useScanJobState((state) => state.error);

  useEffect(
    () =>
      scanJob.subscribeEvents((event) => {
        if (event.type === "started") {
          // 新しいスキャンの開始がサーバー側の真実の境界になるため、開始時点でそれ以前のローカル非表示を破棄する。
          // 完了時ではなく開始時に行うことで、完了通知の非同期到達（SSE再接続・再取得）と
          // 登録/除外操作の競合を避ける。
          setHiddenPaths(new Set());
          return;
        }
        const job = event.job;
        // モーダルが開いている間はサイドバーの「完了しました」が完了通知を担うため、
        // トースト側は重ねて出さない。
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
        if (job.status !== "completed" || !job.result || !job.finishedAt) return;
        errorToast.dismiss();
        const result = job.result;
        queryClient.setQueryData(SCAN_QUERY_KEYS.last(), { result, finishedAt: job.finishedAt });
        void refreshScanCandidates(queryClient).catch(() => {});
        void updateCachesAfterLibraryScan(queryClient);
        queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
        if (!scanModalOpen) {
          void showCompletionToast(queryClient, result).then((hasNeedsAttention) => {
            terminalToast.show({
              message: `スキャン完了: ${formatScanResult(result)}`,
              variant: result.errors > 0 || result.missing > 0 ? "warning" : "success",
              priority: "notice",
              actionLabel: hasNeedsAttention ? "要対応を見る" : undefined,
              // onActionはトーストを自動では閉じない契約（design-system.md）。ここは同期的に
              // 完結する操作なので押した直後に閉じる
              onAction: hasNeedsAttention
                ? () => {
                    setActiveModal({ kind: "scan", tab: "needsAttention" });
                    terminalToast.dismiss();
                  }
                : undefined,
            });
          });
        }
        if (result.insertedWorkIds.length > 0) void dlsiteBulk.attach();
      }),
    [
      dlsiteBulk,
      errorToast,
      jotaiStore,
      queryClient,
      scanJob,
      setActiveModal,
      setHiddenPaths,
      terminalToast,
    ],
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
