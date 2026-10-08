import { queryOptions } from "@tanstack/react-query";
import { getAllTags } from "./api";
import { TAG_QUERY_KEYS } from "./queryKeys";

export const allTagsQueryOptions = queryOptions({
  queryKey: TAG_QUERY_KEYS.all(),
  queryFn: getAllTags,
});
