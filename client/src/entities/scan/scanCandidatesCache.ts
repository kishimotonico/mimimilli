import { isCancelledError, type QueryClient } from "@tanstack/react-query";
import { scanCandidatesResponseSchema, type ScanCandidate } from "@mimimilli/shared";
import { getParsed } from "../../shared/api/http";

export const SCAN_CANDIDATES_QUERY_KEY = ["scan", "candidates"] as const;

export async function fetchScanCandidates(): Promise<ScanCandidate[]> {
  const { candidates } = await getParsed(scanCandidatesResponseSchema, "/scan/candidates");
  return candidates;
}

const scanCandidatesQueryOptions = {
  queryKey: SCAN_CANDIDATES_QUERY_KEY,
  queryFn: fetchScanCandidates,
  staleTime: 0,
} as const;

/** サーバーから候補を明示的に取り直す。候補クエリは enabled:false のため、この呼び出し以外では
 *  再取得されない。後から呼ばれた再取得は実行中のフェッチを打ち切り、最新の応答だけをキャッシュへ反映する。 */
export async function refreshScanCandidates(queryClient: QueryClient): Promise<ScanCandidate[]> {
  const query = queryClient.getQueryCache().build(queryClient, scanCandidatesQueryOptions);
  if (query.state.fetchStatus === "fetching") {
    await query.cancel({ revert: true });
  }

  try {
    return await queryClient.fetchQuery(scanCandidatesQueryOptions);
  } catch (error) {
    if (isCancelledError(error)) {
      return queryClient.getQueryData<ScanCandidate[]>(SCAN_CANDIDATES_QUERY_KEY) ?? [];
    }
    throw error;
  }
}

/** 1件の候補を、サーバーが返した最新の内容で置き換える。一覧に無ければ何もしない。 */
export function replaceScanCandidate(queryClient: QueryClient, candidate: ScanCandidate): void {
  queryClient.setQueryData<ScanCandidate[]>(SCAN_CANDIDATES_QUERY_KEY, (previous) =>
    previous?.map((entry) => (entry.path === candidate.path ? candidate : entry)),
  );
}
