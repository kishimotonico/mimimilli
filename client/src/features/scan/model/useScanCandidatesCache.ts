import { useAtomValue } from "jotai";
import { useQuery } from "@tanstack/react-query";
import type { ScanCandidate } from "@mimimilli/shared";
import { scanCandidatesQueryOptions } from "../../../entities/scan/scanCandidatesCache";
import { scanCandidateHiddenPathsAtom } from "../../../entities/scan/model/atoms";

const EMPTY_SCAN_CANDIDATES: ScanCandidate[] = [];

/** 候補のキャッシュと、まだ一度も読めていないかどうか。 */
export function useScanCandidatesState(): { candidates: ScanCandidate[]; loaded: boolean } {
  // 明示的な refreshScanCandidates 呼び出し以外では取得しない（scanCandidatesCache 参照）。
  const candidatesQuery = useQuery({
    ...scanCandidatesQueryOptions,
    enabled: false,
  });

  const hiddenPaths = useAtomValue(scanCandidateHiddenPathsAtom);

  const source = candidatesQuery.data ?? EMPTY_SCAN_CANDIDATES;

  return {
    candidates:
      hiddenPaths.size === 0
        ? source
        : source.filter((candidate) => !hiddenPaths.has(candidate.path)),
    loaded: candidatesQuery.data !== undefined,
  };
}

export function useScanCandidatesCache(): ScanCandidate[] {
  return useScanCandidatesState().candidates;
}
