import type { QueryClient } from "@tanstack/react-query";
import { scanCandidatesResponseSchema, type ScanCandidate } from "@mimimilli/shared";
import { getParsed } from "../../shared/api/http";

export const SCAN_CANDIDATES_QUERY_KEY = ["scan", "candidates"] as const;
const SCAN_CANDIDATES_REVISION_QUERY_KEY = ["scan", "candidatesRevision"] as const;

async function fetchScanCandidatesFromServer(): Promise<ScanCandidate[]> {
  const { candidates } = await getParsed(scanCandidatesResponseSchema, "/scan/candidates");
  return candidates;
}

function getRevision(queryClient: QueryClient): number {
  return queryClient.getQueryData<number>(SCAN_CANDIDATES_REVISION_QUERY_KEY) ?? 0;
}

function bumpRevision(queryClient: QueryClient): void {
  queryClient.setQueryData(SCAN_CANDIDATES_REVISION_QUERY_KEY, getRevision(queryClient) + 1);
}

function readCache(queryClient: QueryClient): ScanCandidate[] | undefined {
  return queryClient.getQueryData<ScanCandidate[]>(SCAN_CANDIDATES_QUERY_KEY);
}

function writeCache(queryClient: QueryClient, candidates: ScanCandidate[]): ScanCandidate[] {
  bumpRevision(queryClient);
  queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, candidates);
  return candidates;
}

export function updateScanCandidatesCache(
  queryClient: QueryClient,
  updater: (previous: ScanCandidate[]) => ScanCandidate[],
): ScanCandidate[] {
  bumpRevision(queryClient);
  const previous = readCache(queryClient) ?? [];
  const next = updater(previous);
  queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, next);
  return next;
}

export async function refreshScanCandidates(queryClient: QueryClient): Promise<ScanCandidate[]> {
  const issuedRevision = getRevision(queryClient);
  const candidates = await fetchScanCandidatesFromServer();
  if (getRevision(queryClient) !== issuedRevision) {
    return readCache(queryClient) ?? candidates;
  }
  return writeCache(queryClient, candidates);
}
