import type { QueryClient } from "@tanstack/react-query";
import { scanCandidatesResponseSchema, type ScanCandidate } from "@mimimilli/shared";
import { getParsed } from "../../shared/api/http";

export const SCAN_CANDIDATES_QUERY_KEY = ["scan", "candidates"] as const;
const SCAN_CANDIDATES_ISSUED_SEQUENCE_KEY = ["scan", "candidatesIssuedSequence"] as const;
const SCAN_CANDIDATES_APPLIED_SEQUENCE_KEY = ["scan", "candidatesAppliedSequence"] as const;

async function fetchScanCandidatesFromServer(): Promise<ScanCandidate[]> {
  const { candidates } = await getParsed(scanCandidatesResponseSchema, "/scan/candidates");
  return candidates;
}

function getIssuedSequence(queryClient: QueryClient): number {
  return queryClient.getQueryData<number>(SCAN_CANDIDATES_ISSUED_SEQUENCE_KEY) ?? 0;
}

function getAppliedSequence(queryClient: QueryClient): number {
  return queryClient.getQueryData<number>(SCAN_CANDIDATES_APPLIED_SEQUENCE_KEY) ?? 0;
}

function issueSequence(queryClient: QueryClient): number {
  const next = getIssuedSequence(queryClient) + 1;
  queryClient.setQueryData(SCAN_CANDIDATES_ISSUED_SEQUENCE_KEY, next);
  return next;
}

function canApply(queryClient: QueryClient, issued: number): boolean {
  return getAppliedSequence(queryClient) < issued;
}

function readCache(queryClient: QueryClient): ScanCandidate[] | undefined {
  return queryClient.getQueryData<ScanCandidate[]>(SCAN_CANDIDATES_QUERY_KEY);
}

function applyCache(
  queryClient: QueryClient,
  candidates: ScanCandidate[],
  issued: number,
): ScanCandidate[] {
  queryClient.setQueryData(SCAN_CANDIDATES_APPLIED_SEQUENCE_KEY, issued);
  queryClient.setQueryData(SCAN_CANDIDATES_QUERY_KEY, candidates);
  return candidates;
}

export function updateScanCandidatesCache(
  queryClient: QueryClient,
  updater: (previous: ScanCandidate[]) => ScanCandidate[],
): ScanCandidate[] {
  const previous = readCache(queryClient);
  if (previous === undefined) {
    void refreshScanCandidates(queryClient);
    return [];
  }
  const issued = issueSequence(queryClient);
  const next = updater(previous);
  return applyCache(queryClient, next, issued);
}

export async function refreshScanCandidates(queryClient: QueryClient): Promise<ScanCandidate[]> {
  const issued = issueSequence(queryClient);
  const candidates = await fetchScanCandidatesFromServer();
  if (!canApply(queryClient, issued)) {
    return readCache(queryClient) ?? candidates;
  }
  return applyCache(queryClient, candidates, issued);
}
