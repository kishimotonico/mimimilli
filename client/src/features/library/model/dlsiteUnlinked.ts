// DLsite未連携（RJコードは判明しているが取得を一度も試みていない）作品の件数。
// 通知ベルの「まとめて取得」対象件数として表示する（TASK-44）。判定基準は
// @mimimilli/shared の isDlsiteUnlinked を正典とする。
import { useQuery } from "@tanstack/react-query";
import { isDlsiteUnlinked } from "@mimimilli/shared";
import type { WorkSummary } from "@mimimilli/shared";
import { getAllWorks } from "../../../entities/work/api";
import { LIBRARY_KEYS } from "./queryKeys";

export function filterDlsiteUnlinkedWorks(works: WorkSummary[]): WorkSummary[] {
  return works.filter((work) => isDlsiteUnlinked(work.dlsite));
}

/** DLsite未連携の作品件数。他のDLsite系フックと同じく LIBRARY_KEYS.allWorks() を共有し、
 *  一括取得完了時の invalidateQueries で自動的に再取得される。 */
export function useDlsiteUnlinkedCount() {
  const query = useQuery({
    queryKey: LIBRARY_KEYS.allWorks(),
    queryFn: getAllWorks,
  });
  const count = query.data ? filterDlsiteUnlinkedWorks(query.data).length : 0;
  return { count, isLoading: query.isPending };
}
