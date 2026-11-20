import { queryOptions } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "./queryKeys";
import { searchWorks } from "./api";

/** 直近のスキャンで作品になったものの件数。GET /works?scanRecord=new の total を limit:1 で流用する。 */
export const scanNewCountQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.scanNewCount(),
  queryFn: async () => (await searchWorks({ scanRecord: "new", limit: 1 })).total,
});
