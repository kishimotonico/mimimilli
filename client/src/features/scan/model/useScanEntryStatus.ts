import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAtom, useAtomValue } from "jotai";
import { useDlsiteBulkFrame } from "../../../entities/dlsite/useDlsiteJob";
import { scanModalOpenAtom } from "../../../entities/scan/model/atoms";
import {
  scanDiagnosticsQueryOptions,
  scanRecordQueryOptions,
} from "../../../entities/scan/queryOptions";
import { useScanning } from "../../../entities/scan/useScanJob";
import { buildNeedsAttentionRows } from "./needsAttention";
import { scanNewCountQueryOptions } from "../../../entities/work/scanNewCountQueryOptions";
import { composeScanChanges, scanChangesKeys } from "./scanChanges";
import type { ScanEntryRing } from "./scanEntryRing";
import { hasUnseen, nextSeen, scanEntrySeenAtom, type ScanEntryCurrent } from "./scanEntrySeen";
import { useScanCandidatesState } from "./useScanCandidatesCache";

const INACTIVE: ScanEntryRing = { kind: "none" };
const INDETERMINATE: ScanEntryRing = { kind: "indeterminate" };

/** 上のバーのスキャン入口が出す輪と点。モーダルを開いているあいだは見た扱いにして記憶する。 */
export function useScanEntryStatus(): { ring: ScanEntryRing; unseen: boolean } {
  const scanning = useScanning();
  const frame = useDlsiteBulkFrame();
  const open = useAtomValue(scanModalOpenAtom);
  const { candidates, loaded: candidatesLoaded } = useScanCandidatesState();
  const recordQuery = useQuery(scanRecordQueryOptions);
  const diagnosticsQuery = useQuery(scanDiagnosticsQueryOptions);
  const newCountQuery = useQuery(scanNewCountQueryOptions);
  const [seen, setSeen] = useAtom(scanEntrySeenAtom);

  const record = recordQuery.data;
  const diagnostics = diagnosticsQuery.data;
  const newCount = newCountQuery.data;
  const current = useMemo<ScanEntryCurrent>(
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

  useEffect(() => {
    if (!open) return;
    const next = nextSeen(seen, current);
    if (next !== seen) setSeen(next);
  }, [open, seen, current, setSeen]);

  const ring: ScanEntryRing = scanning
    ? INDETERMINATE
    : frame.kind === "progress"
      ? { kind: "determinate", ratio: frame.total === 0 ? 0 : frame.processed / frame.total }
      : INACTIVE;

  return { ring, unseen: !open && hasUnseen(current, seen) };
}
