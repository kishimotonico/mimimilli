import { queryOptions } from "@tanstack/react-query";
import type { ViewId } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { searchWorks } from "./api";

/** 軸レールのビュー行（最近再生・最近追加・お気に入り）の件数。GET /works の total を
 *  limit:1 で流用する（libraryTotalQueryOptions / errorViewCountQueryOptions と同じ形）。
 *  "all" は libraryTotalQueryOptions、"error" は errorViewCountQueryOptions が担う。 */
export function viewCountQueryOptions(view: Exclude<ViewId, "all" | "error">) {
  return queryOptions({
    queryKey: WORK_QUERY_KEYS.viewCount(view),
    queryFn: () => searchWorks({ view, limit: 1 }),
  });
}
