import { queryOptions, skipToken } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { getWork } from "./api";

export function workDetailQueryOptions(workId: string | null) {
  return queryOptions({
    queryKey: WORK_QUERY_KEYS.detail(workId),
    queryFn: workId === null ? skipToken : () => getWork(workId),
  });
}
