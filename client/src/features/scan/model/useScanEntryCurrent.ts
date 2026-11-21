import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  scanDiagnosticsQueryOptions,
  scanRecordQueryOptions,
} from "../../../entities/scan/queryOptions";
import { scanNewCountQueryOptions } from "../../../entities/work/scanNewCountQueryOptions";
import { buildNeedsAttentionRows } from "./needsAttention";
import { composeScanChanges, scanChangesKeys } from "./scanChanges";
import type { ScanEntryCurrent } from "./scanEntrySeen";
import { useScanCandidatesState } from "./useScanCandidatesCache";

/** スキャン入口の点の元になる、いま見えている項目のキー。まだ読めていない集合は null。 */
export function useScanEntryCurrent(): ScanEntryCurrent {
  const { candidates, status: candidatesStatus } = useScanCandidatesState();
  const candidatesLoaded = candidatesStatus === "loaded";
  const record = useQuery(scanRecordQueryOptions).data;
  const diagnostics = useQuery(scanDiagnosticsQueryOptions).data;
  const newCount = useQuery(scanNewCountQueryOptions).data;

  return useMemo<ScanEntryCurrent>(
    () => ({
      candidates: candidatesLoaded ? candidates.map((candidate) => candidate.path) : null,
      needsAttention:
        diagnostics !== undefined
          ? buildNeedsAttentionRows(diagnostics).map((row) => row.key)
          : null,
      changes:
        record !== undefined && newCount !== undefined
          ? scanChangesKeys(composeScanChanges(record, newCount))
          : null,
    }),
    [candidatesLoaded, candidates, record, diagnostics, newCount],
  );
}
