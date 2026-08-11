import { queryOptions } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { searchWorks } from "./api";

/** 軸レールでエラービュー行を0件時に隠すための件数取得。GET /works の total を
 *  limit:1 で流用する（libraryTotalQueryOptions と同じ形。専用の件数APIは新設しない）。 */
export const errorViewCountQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.errorViewCount(),
  queryFn: () => searchWorks({ view: "error", limit: 1 }),
});
