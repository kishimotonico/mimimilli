import { queryOptions } from "@tanstack/react-query";
import { getSmartFolderCounts, listSmartFolders } from "./api";
import { SMART_FOLDER_QUERY_KEYS } from "./queryKeys";

/** スマートフォルダーの定義の一覧（サーバーの順）。ライブラリのすべての前提になる */
export const smartFoldersQueryOptions = queryOptions({
  queryKey: SMART_FOLDER_QUERY_KEYS.all(),
  queryFn: listSmartFolders,
});

/** 件数を出す行の件数（行の ID → 件数）。定義とは別に取り、作品の状態が変わったときはこちらだけを取り直す */
export const smartFolderCountsQueryOptions = queryOptions({
  queryKey: SMART_FOLDER_QUERY_KEYS.counts(),
  queryFn: getSmartFolderCounts,
});
