// ブックマーク後に表示中の一覧をどう揃えるかは、表示中の軸・検索・ソートを知るライブラリが決める。

import type { QueryKey } from "@tanstack/react-query";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { isSmartAxis, getSmartFolderId } from "../../../entities/library/axisDefinitions";
import type { ActiveListCacheHandler } from "../../../entities/work/model/workMutations";
import { buildSmartFolderFilterParams } from "./libraryPresentation";
import { patchBookmarkedInQueryCache } from "./workPatchListCache";
import type { LibraryViewState } from "./useLibraryNavigation";

export function smartOrWorksListKey(
  nav: LibraryViewState,
  worksParams: object | null,
  searchQuery: string,
): QueryKey | null {
  if (isSmartAxis(nav.activeAxis)) {
    return SMART_FOLDER_QUERY_KEYS.works(
      getSmartFolderId(nav.activeAxis),
      buildSmartFolderFilterParams(nav.selectedTags, searchQuery),
    );
  }
  return worksParams !== null ? WORK_QUERY_KEYS.list(worksParams) : null;
}

/** 所属が変わりうるスマートフォルダー軸・お気に入り軸は reset、それ以外は該当行だけ直接パッチする */
export function bookmarkActiveListHandler(
  nav: LibraryViewState,
  activeListQueryKey: QueryKey | null,
): ActiveListCacheHandler | null {
  if (activeListQueryKey === null) return null;
  if (isSmartAxis(nav.activeAxis) || nav.activeAxis === "fav") {
    return {
      queryKey: activeListQueryKey,
      apply: (queryClient) =>
        queryClient.resetQueries({ queryKey: activeListQueryKey, exact: true }),
    };
  }
  return {
    queryKey: activeListQueryKey,
    apply: (queryClient, { workId, bookmarked }) =>
      patchBookmarkedInQueryCache(queryClient, activeListQueryKey, workId, bookmarked),
  };
}
