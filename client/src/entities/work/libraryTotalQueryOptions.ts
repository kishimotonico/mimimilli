import { queryOptions } from "@tanstack/react-query";
import { getAllWorks } from "../smart-folder/api";
import { WORK_QUERY_KEYS } from "./queryKeys";

export const libraryTotalQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.total(),
  queryFn: () => getAllWorks({ limit: 1 }),
});
