// bookmark だけ user DB の値を閲覧キャッシュへ写してよい。

import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Work } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { isSmartAxis, getSmartFolderId } from "../../../entities/library/axisDefinitions";
import { buildSmartFolderFilterParams } from "./libraryPresentation";
import { patchBookmarkedInQueryCache, staleInactiveListCaches } from "./workPatchListCache";
import type { LibraryViewState } from "./useLibraryNavigation";

export function applyBookmarkToWorkCache(
  queryClient: QueryClient,
  workId: string,
  bookmarked: boolean,
): void {
  queryClient.setQueryData<Work>(WORK_QUERY_KEYS.detail(workId), (prev) =>
    prev ? { ...prev, bookmarked } : prev,
  );
}

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

export async function applyBookmarkListCaches(options: {
  queryClient: QueryClient;
  workId: string;
  bookmarked: boolean;
  nav: LibraryViewState;
  activeListQueryKey: QueryKey | null;
}): Promise<void> {
  const { queryClient, workId, bookmarked, nav, activeListQueryKey } = options;
  const resetActive = isSmartAxis(nav.activeAxis) || nav.activeAxis === "fav";
  if (activeListQueryKey !== null && !resetActive) {
    patchBookmarkedInQueryCache(queryClient, activeListQueryKey, workId, bookmarked);
  }
  await Promise.all([
    staleInactiveListCaches(queryClient),
    resetActive && activeListQueryKey !== null
      ? queryClient.resetQueries({ queryKey: activeListQueryKey, exact: true })
      : null,
  ]);
}
