import { isCancelledError, type QueryClient } from "@tanstack/react-query";
import { scanCandidatesResponseSchema, type ScanCandidate } from "@mimimilli/shared";
import { getParsed } from "../../shared/api/http";

export const SCAN_CANDIDATES_QUERY_KEY = ["scan", "candidates"] as const;

export async function fetchScanCandidates(): Promise<ScanCandidate[]> {
  const { candidates } = await getParsed(scanCandidatesResponseSchema, "/scan/candidates");
  return candidates;
}

/** 購読者がいなくても一覧が消えないよう gcTime を無限にする（モーダルを閉じて開き直しても残す） */
export const scanCandidatesQueryOptions = {
  queryKey: SCAN_CANDIDATES_QUERY_KEY,
  queryFn: fetchScanCandidates,
  staleTime: 0,
  gcTime: Number.POSITIVE_INFINITY,
} as const;

const latestRefreshes = new WeakMap<
  QueryClient,
  { ticket: symbol; promise: Promise<ScanCandidate[]> }
>();

/** サーバーから候補を明示的に取り直す。候補クエリは enabled:false のため、この呼び出し以外では
 *  再取得されない。後から呼ばれた再取得は実行中のフェッチを打ち切る。後続に打ち切られた側は最新の
 *  取得の結果を待って返すので、解決したときはその時点の最新のサーバー応答がキャッシュへ反映されている。
 *  最新のまま打ち切られた（キャッシュの破棄など）ときはそのまま投げる。 */
export function refreshScanCandidates(queryClient: QueryClient): Promise<ScanCandidate[]> {
  const ticket = Symbol();
  const run = (async () => {
    const query = queryClient.getQueryCache().build(queryClient, scanCandidatesQueryOptions);
    if (query.state.fetchStatus === "fetching") {
      await query.cancel({ revert: true });
    }
    try {
      return await queryClient.fetchQuery(scanCandidatesQueryOptions);
    } catch (error) {
      const latest = latestRefreshes.get(queryClient);
      if (isCancelledError(error) && latest && latest.ticket !== ticket) return latest.promise;
      throw error;
    }
  })();
  latestRefreshes.set(queryClient, { ticket, promise: run });
  return run;
}

/** 1件の候補を、サーバーが返した最新の内容で置き換える。一覧に無ければ何もしない。 */
export function replaceScanCandidate(queryClient: QueryClient, candidate: ScanCandidate): void {
  queryClient.setQueryData<ScanCandidate[]>(SCAN_CANDIDATES_QUERY_KEY, (previous) =>
    previous?.map((entry) => (entry.path === candidate.path ? candidate : entry)),
  );
}
