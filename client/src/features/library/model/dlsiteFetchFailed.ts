// DLsite取得に失敗したまま残っている（work.dlsite.status が "error" または "not_found"）作品の一覧・件数。
// 判定基準は @mimimilli/shared の isDlsiteFetchFailed を正典とする（TASK-44: 通知ベル）。
//
// 数千作品規模でも GET /works は全件をメモリ上で返す設計（server/src/adapters/real/index.ts の
// コメント参照）なので、既存の useRjCodeMissingWorks と同じく getAllWorks() を使い、
// クライアント側でフィルタする。
import { useQuery } from "@tanstack/react-query";
import { isDlsiteFetchFailed } from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import { getAllWorks } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

export function filterDlsiteFetchFailedWorks(works: WorkSummary[]): WorkSummary[] {
  return works.filter((work) => isDlsiteFetchFailed(work.dlsite));
}

/** DLsite取得失敗の作品一覧・件数。scan完了やDLsite一括取得完了時の作品一覧invalidateに
 *  乗って自動的に再取得される（WORK_QUERY_KEYS.all() と同じキーを使うため）。 */
export function useDlsiteFetchFailedWorks() {
  const query = useQuery({
    queryKey: WORK_QUERY_KEYS.all(),
    queryFn: getAllWorks,
  });
  const works = query.data ? filterDlsiteFetchFailedWorks(query.data) : [];
  return { works, count: works.length, isLoading: query.isPending };
}
