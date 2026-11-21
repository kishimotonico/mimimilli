import { isCancelledError, type QueryClient } from "@tanstack/react-query";
import {
  scanCandidatesResponseSchema,
  type ScanCandidate,
  type ScanCandidatesResponse,
} from "@mimimilli/shared";
import { getParsed } from "../../shared/api/http";

export const SCAN_CANDIDATES_QUERY_KEY = ["scan", "candidates"] as const;

export async function fetchScanCandidates(): Promise<ScanCandidatesResponse> {
  return getParsed(scanCandidatesResponseSchema, "/scan/candidates");
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
  { ticket: symbol; promise: Promise<ScanCandidatesResponse> }
>();

/** サーバーから候補を明示的に取り直す。候補クエリは enabled:false のため、この呼び出し以外では
 *  再取得されない。後から呼ばれた再取得は実行中のフェッチを打ち切る。後続に打ち切られた側は最新の
 *  取得の結果を待って返すので、解決したときはその時点の最新のサーバー応答がキャッシュへ反映されている。
 *  キャッシュにデータが無いまま最新が打ち切られた（キャッシュの破棄など）ときはそのまま投げる。
 *  データがあれば、打ち切られた取得は拒否されず打ち切り前のデータで解決する。
 *  replace を渡すと、打ち切りの後・取り直しの前にその1件をサーバーが返した内容で差し替える。
 *  実行中の取得が差し替えた行を古い値で上書きするのを防ぐ。 */
export function refreshScanCandidates(
  queryClient: QueryClient,
  options: { replace?: ScanCandidate } = {},
): Promise<ScanCandidatesResponse> {
  const ticket = Symbol();
  const run = (async () => {
    const query = queryClient.getQueryCache().build(queryClient, scanCandidatesQueryOptions);
    if (query.state.fetchStatus === "fetching") {
      await query.cancel({ revert: true });
    }
    const { replace } = options;
    if (replace) {
      queryClient.setQueryData<ScanCandidatesResponse>(SCAN_CANDIDATES_QUERY_KEY, (previous) =>
        previous?.scanCompleted
          ? {
              ...previous,
              candidates: previous.candidates.map((entry) =>
                entry.path === replace.path ? replace : entry,
              ),
            }
          : previous,
      );
    }
    const superseded = () => {
      const latest = latestRefreshes.get(queryClient);
      return latest && latest.ticket !== ticket ? latest : null;
    };
    let response: ScanCandidatesResponse;
    try {
      response = await queryClient.fetchQuery(scanCandidatesQueryOptions);
    } catch (error) {
      const latest = superseded();
      if (isCancelledError(error) && latest) return latest.promise;
      throw error;
    }
    // キャッシュにデータがあると、打ち切られた取得は拒否されず打ち切り前のデータで解決する
    return superseded()?.promise ?? response;
  })();
  latestRefreshes.set(queryClient, { ticket, promise: run });
  return run;
}

/** 取り直しの失敗を握り、失敗は候補クエリのエラー状態に任せる。失敗したときは null */
export function refreshScanCandidatesQuietly(
  queryClient: QueryClient,
  options: { replace?: ScanCandidate } = {},
): Promise<ScanCandidatesResponse | null> {
  return refreshScanCandidates(queryClient, options).catch(() => null);
}
