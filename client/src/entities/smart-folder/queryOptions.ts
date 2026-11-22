import { queryOptions } from "@tanstack/react-query";
import { listSmartFolders } from "./api";
import { SMART_FOLDER_QUERY_KEYS } from "./queryKeys";

/** スマートフォルダー一覧（サーバーの順・件数入り）。ライブラリのすべての前提になる */
export const smartFoldersQueryOptions = queryOptions({
  queryKey: SMART_FOLDER_QUERY_KEYS.all(),
  queryFn: listSmartFolders,
});
