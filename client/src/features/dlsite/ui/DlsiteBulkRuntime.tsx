import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useEffect } from "react";
import { updateCachesAfterDlsiteBulkFetch } from "../../../entities/work/model/workCacheUpdates";
import { dlsiteBulkApplyOpenAtom } from "../../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkStore } from "../../../entities/dlsite/useDlsiteBulk";
import { formatDlsiteBulkResult } from "../model/formatDlsiteBulkResult";
import { useToast } from "../../../shared/ui/useToast";

// DLsite一括取得ジョブ（dlsiteBulkStore）の終端・エラーイベントを、トースト・キャッシュ更新へつなぐ。
export default function DlsiteBulkRuntime() {
  const queryClient = useQueryClient();
  const bulk = useDlsiteBulkStore();
  const setApplyOpen = useSetAtom(dlsiteBulkApplyOpenAtom);
  const toast = useToast();

  useEffect(
    () =>
      bulk.subscribeEvents((event) => {
        if (event.type === "error") {
          toast.error(event.message);
          return;
        }
        if (event.type === "terminal") {
          const { terminal } = event;
          if (terminal.status === "complete") {
            toast.show({
              message: `DLsite一括取得: ${formatDlsiteBulkResult(terminal.result)}`,
              variant: terminal.result.failed > 0 ? "warning" : "success",
              priority: "notice",
              actionLabel: "未設定項目を適用",
              onAction: () => setApplyOpen(true),
            });
          } else if (terminal.status === "cancelled") {
            toast.show({
              message: `DLsite一括取得を中断しました（${formatDlsiteBulkResult(terminal.result)}）`,
              variant: "warning",
              priority: "notice",
            });
          } else {
            toast.error(terminal.message);
          }
        }
        void updateCachesAfterDlsiteBulkFetch(queryClient);
      }),
    [bulk, queryClient, setApplyOpen, toast],
  );

  useEffect(() => () => bulk.reset(), [bulk]);

  return null;
}
