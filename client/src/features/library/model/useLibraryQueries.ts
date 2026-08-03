// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type SmartFolderCreate,
  type Work,
  type WorkPatch,
  type WorksPage,
} from "@mimimilli/shared";
import {
  searchWorks,
  getAxisFacets,
  listSmartFolders,
  createSmartFolder,
  updateSmartFolder,
  evalSmartFolder,
} from "../api";
import { getAllTags, getWork, patchWork } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { buildWorksParams, getFacetAxisForQuery } from "./libraryPresentation";
import { useTagPrefixes } from "./useTagPrefixes";
import { useDebouncedValue } from "../../../shared/lib/useDebouncedValue";
import { getWorkPatchInvalidationTargets, mergeWorkPatchResponse } from "./workPatchInvalidation";
import {
  patchWorkInQueryCache,
  staleInactiveListCaches,
  workToListItem,
} from "./workPatchListCache";
import { isSmartAxis, getSmartFolderId } from "./axisDefinitions";
import type { LibraryViewState } from "./useLibraryNavigation";

/** 検索クエリのデバウンス時間（TASK-61）。1文字ごとの全件検索発行を間引く */
const SEARCH_DEBOUNCE_MS = 250;

/** 追加読み込みのページ指定。randomソートのseedを次ページへ引き継ぐ（TASK-73） */
interface WorksPageParam {
  page: number;
  seed: number | undefined;
}

function getNextWorksPageParam(
  lastPage: Awaited<ReturnType<typeof searchWorks>>,
  allPages: Awaited<ReturnType<typeof searchWorks>>[],
  lastPageParam: WorksPageParam,
): WorksPageParam | undefined {
  const loadedCount = allPages.reduce((sum, page) => sum + page.items.length, 0);
  if (lastPage.items.length === 0 || loadedCount >= lastPage.total) return undefined;
  return { page: lastPageParam.page + 1, seed: lastPage.seed ?? lastPageParam.seed };
}

/** Suspense 境界配下でのみ使う通常作品一覧。親で enabled を切り替えない。 */
export function useSuspenseNormalLibraryWorks(nav: LibraryViewState, searchQuery: string) {
  const worksParams = buildWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery,
    selectedTags: nav.selectedTags,
    drillValue: nav.drillValue,
  });
  // 呼び出し側は通常軸だけをマウントする。スマート軸は専用の子コンポーネントが担当する。
  const normalWorksParams = worksParams!;

  const query = useSuspenseInfiniteQuery({
    queryKey: WORK_QUERY_KEYS.list(normalWorksParams),
    queryFn: ({ pageParam, signal }) =>
      searchWorks(
        {
          ...normalWorksParams,
          page: pageParam.page,
          limit: WORKS_DEFAULT_PAGE_SIZE,
          seed: pageParam.seed,
        },
        { signal },
      ),
    initialPageParam: { page: 1, seed: undefined } as WorksPageParam,
    getNextPageParam: getNextWorksPageParam,
  });
  return toSuspenseWorksResult(query, normalWorksParams);
}

/** 作品クエリのキーに渡す検索語。Suspense境界の外で維持して連続入力を間引く。 */
export function useLibraryDebouncedSearchQuery(searchQuery: string) {
  return useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS, searchQuery === "");
}

/** Suspense 境界配下でのみ使うスマートフォルダー作品一覧。 */
export function useSuspenseSmartLibraryWorks(nav: LibraryViewState) {
  const smartAxisId = getSmartFolderId(nav.activeAxis);
  const query = useSuspenseInfiniteQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.works(smartAxisId),
    queryFn: ({ pageParam, signal }) =>
      evalSmartFolder(
        smartAxisId,
        { page: pageParam.page, limit: WORKS_DEFAULT_PAGE_SIZE, seed: pageParam.seed },
        { signal },
      ),
    initialPageParam: { page: 1, seed: undefined } as WorksPageParam,
    getNextPageParam: getNextWorksPageParam,
  });
  return toSuspenseWorksResult(query, { smartFolderId: smartAxisId, sort: nav.sort });
}

function toSuspenseWorksResult(
  query: {
    data: { pages: WorksPage[] };
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => Promise<unknown>;
    refetch: () => Promise<unknown>;
  },
  worksParams: unknown,
) {
  const lastPage = query.data.pages[query.data.pages.length - 1];
  return {
    works: query.data.pages.flatMap((page) => page.items),
    worksParams,
    hasNextPage: query.hasNextPage,
    worksTotal: lastPage?.total,
    worksStats: lastPage?.stats,
    isFetchingNextPage: query.isFetchingNextPage,
    fetchNextPage: query.fetchNextPage,
    refetchWorks: query.refetch,
  };
}

/**
 * 作品一覧以外の LibraryView 用クエリ。作品クエリは Suspense 境界の子へ下ろすため、
 * このフックは一覧を取得しない。
 */
export function useLibrarySupportingQueries(nav: LibraryViewState) {
  const libraryTotalQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.total(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });
  const facetAxis = getFacetAxisForQuery(nav.activeAxis, nav.drillValue);
  const facetQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.facets(facetAxis ?? ""),
    queryFn: () => getAxisFacets(facetAxis!),
    enabled: facetAxis !== null,
  });
  const smartFoldersQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
  });
  const workDetailQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(nav.selectedWorkId ?? ""),
    queryFn: () => getWork(nav.selectedWorkId!),
    enabled: nav.selectedWorkId !== null,
  });
  const tagsQuery = useQuery({ queryKey: TAG_QUERY_KEYS.all(), queryFn: getAllTags });
  const {
    tagPrefixes,
    isError: isTagPrefixesError,
    refetch: refetchTagPrefixes,
  } = useTagPrefixes();

  return {
    libraryTotal: libraryTotalQuery.data,
    facetItems: facetQuery.data ?? [],
    isFacetLoading: facetQuery.isLoading,
    isFacetError: facetQuery.isError,
    refetchFacets: facetQuery.refetch,
    smartFolders: smartFoldersQuery.data ?? [],
    selectedWork: workDetailQuery.data ?? null,
    workDetailQuery,
    tagSuggestions: tagsQuery.data ?? [],
    tagPrefixes,
    isTagPrefixesError,
    refetchTagPrefixes,
  };
}

export function useLibraryPatchWorkMutation(nav: LibraryViewState, searchQuery: string) {
  const queryClient = useQueryClient();
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery,
    SEARCH_DEBOUNCE_MS,
    searchQuery === "",
  );
  const worksParams = buildWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery: debouncedSearchQuery,
    selectedTags: nav.selectedTags,
    drillValue: nav.drillValue,
  });

  return useMutation({
    mutationFn: ({ workId, body }: { workId: string; body: WorkPatch }) => patchWork(workId, body),
    onSuccess: async (updatedWork, { workId, body }) => {
      queryClient.setQueryData<Work>(WORK_QUERY_KEYS.detail(workId), (prev) =>
        mergeWorkPatchResponse(prev, body, updatedWork),
      );
      const targets = getWorkPatchInvalidationTargets(body, {
        activeAxis: nav.activeAxis,
        sort: nav.sort,
        searchQuery: debouncedSearchQuery,
        selectedTags: nav.selectedTags,
        drillValue: nav.drillValue,
      });
      const activeListQueryKey = isSmartAxis(nav.activeAxis)
        ? SMART_FOLDER_QUERY_KEYS.works(getSmartFolderId(nav.activeAxis))
        : worksParams !== null
          ? WORK_QUERY_KEYS.list(worksParams)
          : null;
      if (targets.patchActiveListCache && activeListQueryKey !== null) {
        patchWorkInQueryCache(queryClient, activeListQueryKey, workId, workToListItem(updatedWork));
      }
      await Promise.all([
        targets.staleInactiveListCaches ? staleInactiveListCaches(queryClient) : null,
        targets.resetActiveWorksList && activeListQueryKey !== null
          ? queryClient.resetQueries({ queryKey: activeListQueryKey, exact: true })
          : null,
        targets.facets
          ? queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() })
          : null,
        targets.tags ? queryClient.invalidateQueries({ queryKey: TAG_QUERY_KEYS.all() }) : null,
      ]);
    },
    onError: (error, { workId, body }) => {
      console.error("作品メタデータの更新に失敗しました", { workId, body, error });
    },
  });
}

// ── スマートフォルダー作成・編集 mutation ─────────────────────
// setSmartFolderEditor / nav.setAxis は LibraryView 側の UI state のため、
// 成功時コールバックとして呼び出し側から渡してもらう。
export function useSmartFolderMutation(callbacks: {
  onSaved: (savedFolder: SmartFolder, wasNew: boolean) => void;
  onError: (wasNew: boolean, error: unknown) => void;
}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ folder, input }: { folder: SmartFolder | null; input: SmartFolderCreate }) =>
      folder ? updateSmartFolder(folder.id, input) : createSmartFolder(input),
    onSuccess: async (savedFolder, { folder }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.all() }),
        queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() }),
      ]);
      callbacks.onSaved(savedFolder, folder === null);
    },
    onError: (error, { folder }) => {
      callbacks.onError(folder === null, error);
    },
  });
}
