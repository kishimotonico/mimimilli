// ブックマーク後に表示中の一覧をどう揃えるかは、表示中のスマートフォルダー・検索・並びを知るライブラリが決める。

import type { QueryKey } from "@tanstack/react-query";
import { normalizeSearchQuery, type Condition } from "@mimimilli/shared";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import type { SmartFolderWorksParams } from "../../../entities/smart-folder/api";
import type { ActiveListCacheHandler } from "../../../entities/work/model/workMutations";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import { patchBookmarkedInQueryCache } from "./workPatchListCache";

type WorksView = Extract<ResolvedLibraryView, { kind: "works" }>;

/** 作品一覧の要求。ページ以外は解決済みの値だけで決まる（今の並び・既定・seed の違いは結果の違い） */
export function folderWorksParams(
  view: WorksView,
  searchQuery: string,
): Omit<SmartFolderWorksParams, "page" | "limit"> {
  return {
    q: normalizeSearchQuery(searchQuery),
    tags: view.selectedTags,
    group: view.group,
    sort: view.sort,
    seed: view.seed,
  };
}

/** スマートフォルダーの作品一覧の query key。seed は並びの一部なのでキーに含める */
export function folderWorksKey(view: WorksView, searchQuery: string): QueryKey {
  return SMART_FOLDER_QUERY_KEYS.works(view.folder.id, folderWorksParams(view, searchQuery));
}

function usesBookmarked(condition: Condition): boolean {
  switch (condition.type) {
    case "bookmarked":
      return true;
    case "and":
    case "or":
      return condition.children.some(usesBookmarked);
    case "not":
      return usesBookmarked(condition.child);
    default:
      return false;
  }
}

/** 条件がお気に入りに依存するスマートフォルダーは所属が変わりうるので reset、
 *  それ以外は該当行だけ直接パッチする */
export function bookmarkActiveListHandler(
  view: ResolvedLibraryView,
  searchQuery: string,
): ActiveListCacheHandler | null {
  if (view.kind !== "works") return null;
  const queryKey = folderWorksKey(view, searchQuery);
  if (view.folder.condition !== null && usesBookmarked(view.folder.condition)) {
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
