import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ScanJobSnapshot, StartScanRequest } from "@mimimilli/shared";
import { SETTINGS_QUERY_KEYS } from "../../../entities/settings/queryKeys";
import { useDlsiteBulkActions } from "../../../entities/dlsite/useDlsiteBulkActions";
import { SCAN_QUERY_KEYS } from "../api";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import { invalidateLibraryQueries } from "../model/libraryInvalidation";
import {
  scanActionsAtom,
  scanCandidateHiddenPathsAtom,
  scanErrorAtom,
  scanJobAtom,
  scanModalOpenAtom,
  scanResultToastAtom,
  type ScanActions,
} from "../../../entities/scan/model/atoms";
import { useScanJob } from "../model/useScanJob";

// SSE 購読の単一所有者。scanJobAtom / scanActionsAtom をここで配線する。
export default function ScanRuntime() {
  const queryClient = useQueryClient();
  const dlsiteBulk = useDlsiteBulkActions();
  const setJob = useSetAtom(scanJobAtom);
  const setError = useSetAtom(scanErrorAtom);
  const setActions = useSetAtom(scanActionsAtom);
  const setHiddenPaths = useSetAtom(scanCandidateHiddenPathsAtom);
  const setResultToast = useSetAtom(scanResultToastAtom);
  // モーダルが開いている間はサイドバーの「完了しました」が完了通知を担うため、
  // トースト側は重ねて出さない（scan-dlsite-A-04/B-05）。SSEイベントの時点で最新値を見たいためrefで持つ。
  const scanModalOpen = useAtomValue(scanModalOpenAtom);
  const scanModalOpenRef = useRef(scanModalOpen);
  useLayoutEffect(() => {
    scanModalOpenRef.current = scanModalOpen;
  }, [scanModalOpen]);

  const handleScanTerminal = useCallback(
    (job: ScanJobSnapshot) => {
      if (job.status === "cancelled") {
        if (!scanModalOpenRef.current) setResultToast({ kind: "cancelled" });
        return;
      }
      if (job.status !== "completed" || !job.result || !job.finishedAt) return;
      const result = job.result;
      queryClient.setQueryData(SCAN_QUERY_KEYS.last(), { result, finishedAt: job.finishedAt });
      void refreshScanCandidates(queryClient).catch(() => {});
      void invalidateLibraryQueries(queryClient);
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      if (!scanModalOpenRef.current) setResultToast({ kind: "completed", result });
      if (result.insertedWorkIds.length > 0) dlsiteBulk.attach();
    },
    [dlsiteBulk, queryClient, setResultToast],
  );

  // 新しいスキャンの開始がサーバー側の真実の境界になるため、開始時点でそれ以前のローカル非表示を破棄する。
  // 完了時ではなく開始時に行うことで、完了通知の非同期到達（SSE再接続・再取得）と
  // 登録/除外操作の競合を避ける。
  const handleScanStart = useCallback(() => {
    setHiddenPaths(new Set());
  }, [setHiddenPaths]);

  const scanJob = useScanJob({ onTerminal: handleScanTerminal, onStart: handleScanStart });
  const scanJobRef = useRef(scanJob);
  useLayoutEffect(() => {
    scanJobRef.current = scanJob;
  }, [scanJob]);

  useEffect(() => {
    setJob(scanJob.job);
  }, [scanJob.job, setJob]);

  useEffect(() => {
    setError(scanJob.error);
  }, [scanJob.error, setError]);

  const actionsRef = useRef<ScanActions>({
    start: async (options?: StartScanRequest) => scanJobRef.current.start(options),
    cancel: async () => scanJobRef.current.cancel(),
    clearError: () => {
      scanJobRef.current.clearError();
    },
  });

  useEffect(() => {
    setActions(actionsRef.current);
    return () => setActions(null);
  }, [setActions]);

  return null;
}
