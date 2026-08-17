import type { QueryClient } from "@tanstack/react-query";
import type { ScanCandidate, ScanLastResultResponse } from "@mimimilli/shared";
import { SCAN_QUERY_KEYS } from "../api";

export function applyScanTerminalCandidates(
  queryClient: QueryClient,
  finishedAt: string,
  candidates: ScanCandidate[],
): void {
  const prevFinishedAt = queryClient.getQueryData<ScanLastResultResponse>(
    SCAN_QUERY_KEYS.last(),
  )?.finishedAt;
  if (prevFinishedAt === finishedAt) return;
  queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), candidates);
}
