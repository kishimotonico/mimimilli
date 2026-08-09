import { queryOptions } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { searchWorks } from "./api";

export const libraryTotalQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.total(),
  queryFn: () => searchWorks({ limit: 1 }),
});
