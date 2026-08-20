import { queryOptions } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { getMissingWorksCount } from "./api";

export const missingWorksCountQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.missingCount(),
  queryFn: getMissingWorksCount,
});
