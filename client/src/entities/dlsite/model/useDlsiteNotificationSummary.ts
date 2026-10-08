import { useQuery } from "@tanstack/react-query";
import { dlsiteNotificationSummaryQueryOptions } from "./dlsiteNotificationSummaryQueryOptions";

export function useDlsiteNotificationSummary() {
  const query = useQuery(dlsiteNotificationSummaryQueryOptions);
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
