// スキャンで検出できなかったRJコード（work.dlsite.rjCode === null）が残っている作品の一覧・件数。
// 判定基準は @mimimilli/shared の isRjCodeMissing を正典とし、サーバー側（ScanResult.rjCodeMissingCount）
// と食い違わないようにする。
//
// 数千作品規模でも GET /works は全件をメモリ上で返す設計（server/src/adapters/real/index.ts の
// コメント参照）なので、既存の NewWorkPopup と同じく getAllWorks() を使い、クライアント側でフィルタする。
import { useQuery } from "@tanstack/react-query";
import { isRjCodeMissing } from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import { getAllWorks } from "../../../entities/work/api";
import { LIBRARY_KEYS } from "./queryKeys";

export function filterRjCodeMissingWorks(works: WorkSummary[]): WorkSummary[] {
  return works.filter((work) => isRjCodeMissing(work.dlsite));
}

/** RJコード未検出の作品一覧・件数。scan完了やDLsite一括取得完了時の invalidateQueries(["works"]) に
 *  乗って自動的に再取得される（LIBRARY_KEYS.allWorks() と同じキーを使うため）。 */
export function useRjCodeMissingWorks() {
  const query = useQuery({
    queryKey: LIBRARY_KEYS.allWorks(),
    queryFn: getAllWorks,
  });
  const works = query.data ? filterRjCodeMissingWorks(query.data) : [];
  return { works, count: works.length, isLoading: query.isPending };
}
