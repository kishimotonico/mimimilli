import { queryOptions } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "../../work/queryKeys";
import { getDlsiteNotificationSummary } from "../../work/api";

export const dlsiteNotificationSummaryQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.dlsiteNotificationSummary(),
  queryFn: () => getDlsiteNotificationSummary(),
});
