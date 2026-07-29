import { useQuery } from "@tanstack/react-query";
import { getDlsiteNotificationSummary } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";

export function useDlsiteNotificationSummary() {
  const query = useQuery({
    queryKey: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
    queryFn: getDlsiteNotificationSummary,
  });
  const data = query.data;
  return {
    rjCodeMissingCount: data?.rjCodeMissingCount ?? 0,
    fetchFailedCount: data?.fetchFailedCount ?? 0,
    parseErrorCount: data?.parseErrorCount ?? 0,
    parseErrorAlert: data?.parseErrorAlert ?? false,
    unlinkedCount: data?.unlinkedCount ?? 0,
    isLoading: query.isPending,
  };
}
