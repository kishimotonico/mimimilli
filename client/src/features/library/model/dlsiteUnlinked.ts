import { useQuery } from "@tanstack/react-query";
import { isDlsiteUnlinked, type WorkSummary } from "@mimimilli/shared";
import { getDlsiteNotificationSummary } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

/** 後方互換の純粋関数。通知件数は専用APIで取得する。 */
export function filterDlsiteUnlinkedWorks(works: WorkSummary[]): WorkSummary[] {
  return works.filter((work) => isDlsiteUnlinked(work.dlsite));
}

export function useDlsiteUnlinkedCount() {
  const query = useQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
    queryFn: getDlsiteNotificationSummary,
  });
  return { count: query.data?.unlinkedCount ?? 0, isLoading: query.isPending };
}
