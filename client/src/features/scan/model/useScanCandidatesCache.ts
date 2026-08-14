import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { ScanCandidate, ScanLastResultResponse } from "@mimimilli/shared";
import { getLastScanResult, SCAN_QUERY_KEYS } from "../api";

const EMPTY_SCAN_CANDIDATES: ScanCandidate[] = [];

export function syncScanCandidatesFromLast(
  last: ScanLastResultResponse | null | undefined,
  candidates: ScanCandidate[] | undefined,
): ScanCandidate[] | undefined {
  if (candidates !== undefined) return candidates;
  return last?.result.candidates;
}

function readScanCandidates(
  queryClient: QueryClient,
  last: ScanLastResultResponse | null | undefined,
): ScanCandidate[] {
  const cached = queryClient.getQueryData<ScanCandidate[]>(SCAN_QUERY_KEYS.candidates());
  if (cached !== undefined) return cached;
  const fromLast = syncScanCandidatesFromLast(last, undefined);
  if (fromLast !== undefined) return fromLast;
  return EMPTY_SCAN_CANDIDATES;
}

function subscribeToScanCandidates(
  queryClient: QueryClient,
  onStoreChange: () => void,
): () => void {
  const queryKey = SCAN_QUERY_KEYS.candidates();
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.query.queryHash !== queryClient.getQueryCache().find({ queryKey })?.queryHash) {
      return;
    }
    onStoreChange();
  });
}

export function useScanCandidatesCache(): ScanCandidate[] {
  const queryClient = useQueryClient();

  const lastQuery = useQuery({
    queryKey: SCAN_QUERY_KEYS.last(),
    queryFn: getLastScanResult,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
  });

  return useSyncExternalStore(
    (onStoreChange) => subscribeToScanCandidates(queryClient, onStoreChange),
    () => readScanCandidates(queryClient, lastQuery.data),
    () => readScanCandidates(queryClient, lastQuery.data),
  );
}

export function useUnregisteredCandidateCount(): number {
  return useScanCandidatesCache().length;
}
