import { useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { ScanJobSnapshot, StartScanRequest } from "@mimimilli/shared";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../../../entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { useDlsiteBulkActions } from "../../../entities/dlsite/useDlsiteBulkActions";
import { SCAN_QUERY_KEYS } from "../api";
import { refreshScanCandidates } from "../../../entities/scan/scanCandidatesCache";
import {
  scanActionsAtom,
  scanErrorAtom,
  scanJobAtom,
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

  const handleScanTerminal = useCallback(
    (job: ScanJobSnapshot) => {
      if (job.status !== "completed" || !job.result || !job.finishedAt) return;
      const result = job.result;
      queryClient.setQueryData(SCAN_QUERY_KEYS.last(), { result, finishedAt: job.finishedAt });
      void refreshScanCandidates(queryClient);
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.dlsiteNotifications() });
      queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() });
      queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.all() });
      if (result.insertedWorkIds.length > 0) dlsiteBulk.attach();
    },
    [dlsiteBulk, queryClient],
  );

  const scanJob = useScanJob({ onTerminal: handleScanTerminal });
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
