import { useQuery } from "@tanstack/react-query";
import type { ScanCandidate } from "@mimimilli/shared";
import { scanCandidatesQueryOptions } from "../../../entities/scan/scanCandidatesCache";

const EMPTY_SCAN_CANDIDATES: ScanCandidate[] = [];

/** 候補のキャッシュと、まだ一度も読めていないかどうか。 */
export function useScanCandidatesState(): { candidates: ScanCandidate[]; loaded: boolean } {
  // 候補の取得は、打ち切りと待ち合わせのある refreshScanCandidates だけを通す。
  // 自動取得（マウント・invalidate・フォーカス復帰）はその手順を通らず、RJコードの差し替えや登録後の待ち合わせを壊す。
  const candidatesQuery = useQuery({
    ...scanCandidatesQueryOptions,
    enabled: false,
  });

  return {
    candidates: candidatesQuery.data ?? EMPTY_SCAN_CANDIDATES,
    loaded: candidatesQuery.data !== undefined,
  };
}

export function useScanCandidatesCache(): ScanCandidate[] {
  return useScanCandidatesState().candidates;
}
