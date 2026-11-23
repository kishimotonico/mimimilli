import { queryOptions } from "@tanstack/react-query";
import { getAllWorks } from "../smart-folder/api";
import { WORK_QUERY_KEYS } from "./queryKeys";

/** 直近のスキャンで作品になったものの件数。「すべて」の scanRecord=new の total を limit:1 で流用する。 */
export const scanNewCountQueryOptions = queryOptions({
  queryKey: WORK_QUERY_KEYS.scanNewCount(),
  queryFn: async ({ signal }) =>
    (await getAllWorks({ scanRecord: "new", limit: 1 }, { signal })).total,
});
