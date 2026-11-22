// ブックマーク後に表示中の一覧をどう揃えるかは、表示中のスマートフォルダー・検索・並びを知るライブラリが決める。

import { usesBookmarked } from "@mimimilli/shared";
import type { ActiveListCacheHandler } from "../../../entities/work/model/workMutations";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import { folderWorksKey } from "./folderWorksRequest";
import { patchBookmarkedInQueryCache } from "./workPatchListCache";

/** 条件がお気に入りに依存するスマートフォルダーは所属が変わりうるので reset、
 *  それ以外は該当行だけ直接パッチする */
export function bookmarkActiveListHandler(
  view: ResolvedLibraryView,
  searchQuery: string,
): ActiveListCacheHandler | null {
  if (view.kind !== "works") return null;
  const queryKey = folderWorksKey(view, searchQuery);
  if (usesBookmarked(view.condition)) {
    return {
      queryKey,
      apply: (queryClient) => queryClient.resetQueries({ queryKey, exact: true }),
    };
  }
  return {
    queryKey,
    apply: (queryClient, { workId, bookmarked }) =>
      patchBookmarkedInQueryCache(queryClient, queryKey, workId, bookmarked),
  };
}
