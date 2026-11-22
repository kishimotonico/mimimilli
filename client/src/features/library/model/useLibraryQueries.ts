// LibraryView が使う query 群・mutation 群の集約。
// コンポーネント側は返された view model を配線するだけにする。

import { useQuery, useSuspenseInfiniteQuery } from "@tanstack/react-query";
import { WORKS_DEFAULT_PAGE_SIZE, type WorksPage } from "@mimimilli/shared";
import { getSmartFolderWorks } from "../../../entities/smart-folder/api";
import { allTagsQueryOptions } from "../../../entities/tag/allTagsQueryOptions";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { useDebouncedValue } from "../../../shared/lib/useDebouncedValue";
import {
  useAddWorkTagMutation,
  useBookmarkWorkMutation,
  useEditWorkSourceMutation,
  useRemoveWorkTagMutation,
} from "../../../entities/work/model/workMutations";
import { missingWorksCountQueryOptions } from "../../../entities/work/missingWorksCountQueryOptions";
import type { ResolvedLibraryView } from "../../../entities/library/resolveLibraryView";
import {
  bookmarkActiveListHandler,
  folderWorksKey,
  folderWorksParams,
} from "./workPatchInvalidation";
import { useGroupValuesQuery } from "./useGroupValuesQuery";
import type { ReadyLibraryViewState } from "./useLibraryNavigation";

/** 検索クエリのデバウンス時間。1文字ごとの全件検索発行を間引く */
const SEARCH_DEBOUNCE_MS = 250;

type WorksView = Extract<ResolvedLibraryView, { kind: "works" }>;

interface WorksPageParam {
  page: number;
}

function getNextWorksPageParam(
  lastPage: WorksPage,
  allPages: WorksPage[],
  lastPageParam: WorksPageParam,
): WorksPageParam | undefined {
  const loadedCount = allPages.reduce((sum, page) => sum + page.items.length, 0);
  if (lastPage.items.length === 0 || loadedCount >= lastPage.total) return undefined;
  return { page: lastPageParam.page + 1 };
}

/** Suspense 境界配下でのみ使う作品一覧。解決済みの並びと seed をそのまま API に渡す。 */
export function useSuspenseLibraryWorks(view: WorksView, searchQuery: string) {
  const query = useSuspenseInfiniteQuery({
    queryKey: folderWorksKey(view, searchQuery),
    queryFn: ({ pageParam, signal }) =>
      getSmartFolderWorks(
        view.folder.id,
        {
          ...folderWorksParams(view, searchQuery),
          page: pageParam.page,
          limit: WORKS_DEFAULT_PAGE_SIZE,
        },
        { signal },
      ),
    initialPageParam: { page: 1 } as WorksPageParam,
    getNextPageParam: getNextWorksPageParam,
  });
  const lastPage = query.data.pages[query.data.pages.length - 1];
  return {
    works: query.data.pages.flatMap((page) => page.items),
    hasNextPage: query.hasNextPage,
    worksTotal: lastPage?.total,
    worksStats: lastPage?.stats,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetchWorks: query.refetch,
  };
}

/** 作品クエリのキーに渡す検索語。Suspense境界の外で維持して連続入力を間引く。 */
export function useLibraryDebouncedSearchQuery(searchQuery: string) {
  return useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS, searchQuery === "");
}

/** 開いているスマートフォルダー自身の値一覧（グループ分け）。サイドバーのクイックオーバーレイ・
 *  パンくずの兄弟値と同じ母集団（絞り込み無し）なので、同じ query を共有する */
export function useFolderGroupValuesQuery(view: ResolvedLibraryView) {
  const groupBy = view.kind === "value-list" ? view.groupBy : null;
  return useGroupValuesQuery(groupBy, {
    folderId: view.folder.id,
  });
}

/**
 * 作品一覧以外の LibraryView 用クエリ。作品クエリは Suspense 境界の子へ下ろすため、
 * このフックは一覧を取得しない。
 */
export function useLibrarySupportingQueries(nav: ReadyLibraryViewState) {
  const groupValuesQuery = useFolderGroupValuesQuery(nav.view);
  const workDetailQuery = useQuery(workDetailQueryOptions(nav.selectedWorkId));
  const tagsQuery = useQuery(allTagsQueryOptions);
  const {
    tagPrefixes,
    isError: isTagPrefixesError,
    refetch: refetchTagPrefixes,
  } = useTagPrefixes();

  return {
    groupValueItems: groupValuesQuery.data ?? [],
    isGroupValuesLoading: groupValuesQuery.isLoading,
    isGroupValuesError: groupValuesQuery.isError,
    refetchGroupValues: groupValuesQuery.refetch,
    selectedWork: workDetailQuery.data ?? null,
    workDetailQuery,
    tagSuggestions: tagsQuery.data ?? [],
    tagPrefixes,
    isTagPrefixesError,
    refetchTagPrefixes,
  };
}

/** 編集ダイアログの一括保存（title・tags・urls）・ブックマーク・詳細ペイン常駐タグの
 *  意図コマンドを独立した mutation として提供する。ブックマークだけは表示中の一覧を
 *  画面側で揃え、その一覧の再取得を省く */
/** view は一覧が揃うまで null。ブックマーク後に差し替える表示中の一覧が無い */
export function useLibraryWorkPatchMutations(
  view: ResolvedLibraryView | null,
  searchQuery: string,
) {
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const editMutation = useEditWorkSourceMutation();
  const bookmarkMutation = useBookmarkWorkMutation({
    activeList: view ? bookmarkActiveListHandler(view, debouncedSearchQuery) : null,
  });
  const addTagMutation = useAddWorkTagMutation();
  const removeTagMutation = useRemoveWorkTagMutation();

  return { editMutation, bookmarkMutation, addTagMutation, removeTagMutation };
}

/** エラー一覧表示中だけ、missing件数を取得する（一括登録解除の導線・確認ダイアログ用） */
export function useMissingWorksCountQuery(enabled: boolean) {
  return useQuery({ ...missingWorksCountQueryOptions, enabled });
}
