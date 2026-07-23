import { useQuery } from "@tanstack/react-query";
import { getDlsiteNotificationSummary } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

export function useDlsiteUnlinkedCount() {
  const query = useQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
    queryFn: getDlsiteNotificationSummary,
  });
  return { count: query.data?.unlinkedCount ?? 0, isLoading: query.isPending };
}
