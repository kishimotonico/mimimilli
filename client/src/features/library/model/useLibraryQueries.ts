// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
  type UseMutationResult,
} from "@tanstack/react-query";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type NormalizedTag,
  type SmartFolder,
  type SmartFolderCreate,
  type Work,
  type WorkPatchInput,
  type WorksPage,
} from "@mimimilli/shared";
import { searchWorks } from "../../../entities/work/api";
import {
  listSmartFolders,
  createSmartFolder,
  updateSmartFolder,
  evalSmartFolder,
} from "../../../entities/smart-folder/api";
import { getAllTags } from "../../../entities/tag/api";
import { getWork, patchWork } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";

export type LibraryTitlePatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; title: string }
>;

export type LibraryBookmarkPatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; bookmarked: boolean }
>;

export type LibraryTagsPatchMutation = UseMutationResult<
  Work,
  Error,
  { workId: string; tags: NormalizedTag[] }
>;
import {
  buildSmartFolderFilterParams,
  buildWorksParams,
  computeCollectionStatsDisplay,
  getFacetAxisForQuery,
} from "./libraryPresentation";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { useAxisFacetsQuery } from "./useAxisFacetsQuery";
import { useDebouncedValue } from "../../../shared/lib/useDebouncedValue";
import { getWorkPatchInvalidationTargets, mergeWorkPatchResponse } from "./workPatchInvalidation";
import {
  patchWorkInQueryCache,
  staleInactiveListCaches,
  workToListItem,
} from "./workPatchListCache";
import { isSmartAxis, getSmartFolderId } from "../../../entities/library/axisDefinitions";
import type { LibraryViewState } from "./useLibraryNavigation";

/** 検索クエリのデバウンス時間（TASK-61）。1文字ごとの全件検索発行を間引く */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * limit:1 の全件検索（ライブラリ総件数・統計）。queryKey/queryFn/型を1箇所にまとめ、
 * 呼び出し側（本フック・ScanModal）が個別に useQuery({queryKey, queryFn}) を書かないようにする。
 *
 * 同じ queryKey を持つ useQuery が呼び出し側ごとに違う queryFn（違う戻り値の形）を持つと、
 * React Query は queryKey が同一かどうかしか見ないため、先に解決した方の形が cache を占有し、
 * 後から subscribe した側は自分の queryFn の戻り値ではなく cache の値をそのまま .data として
 * 受け取る（TASK-188: ScanModal 側が number を、こちら側が WorksPage 全体を期待していて
 * 衝突し、WorksPage オブジェクトを JSX の子として描画してクラッシュした）。
 * queryOptions() で定義を共有すれば、両者の .data の型が常に一致し、この種の食い違いは
 * 型チェックの時点で検知できる。
 */
import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
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

/** Suspense 境界配下でのみ使うスマートフォルダー作品一覧。
 *  保持中のタグ/組み込み軸フィルタをフォルダーのルールへの追加 AND として渡す（ADR-0012）。 */
export function useSuspenseSmartLibraryWorks(nav: LibraryViewState) {
  const smartAxisId = getSmartFolderId(nav.activeAxis);
  const filterParams = buildSmartFolderFilterParams(nav.selectedTags);
  const query = useSuspenseInfiniteQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.works(smartAxisId, filterParams),
    queryFn: ({ pageParam, signal }) =>
      evalSmartFolder(
        smartAxisId,
        {
          ...filterParams,
          page: pageParam.page,
          limit: WORKS_DEFAULT_PAGE_SIZE,
          seed: pageParam.seed,
        },
        { signal },
      ),
    initialPageParam: { page: 1, seed: undefined } as WorksPageParam,
    getNextPageParam: getNextWorksPageParam,
  });
  return toSuspenseWorksResult(query, {
    smartFolderId: smartAxisId,
    sort: nav.sort,
    ...filterParams,
  });
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
    dataIntegrityWarning: lastPage?.dataIntegrityWarning,
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
  // 件数バッジ（libraryTotal）と軸レール下部のライブラリ統計表示を兼ねる。
  const libraryStatsQuery = useQuery(libraryTotalQueryOptions);
  const facetAxis = getFacetAxisForQuery(nav.activeAxis);
  const facetQuery = useAxisFacetsQuery(facetAxis, nav.selectedTags);
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
    libraryTotal: libraryStatsQuery.data?.total,
    libraryStats: computeCollectionStatsDisplay(
      libraryStatsQuery.isLoading,
      libraryStatsQuery.isError,
      libraryStatsQuery.data?.total,
      libraryStatsQuery.data?.stats,
    ),
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

function useWorkPatchMutationContext(nav: LibraryViewState, searchQuery: string) {
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
  });

  const applyPatchSuccess = async (
    updatedWork: Work,
    workId: string,
    body: WorkPatchInput,
  ): Promise<void> => {
    queryClient.setQueryData<Work>(WORK_QUERY_KEYS.detail(workId), (prev) =>
      mergeWorkPatchResponse(prev, body, updatedWork),
    );
    const targets = getWorkPatchInvalidationTargets(body, {
      activeAxis: nav.activeAxis,
      sort: nav.sort,
      searchQuery: debouncedSearchQuery,
      selectedTags: nav.selectedTags,
    });
    const activeListQueryKey = isSmartAxis(nav.activeAxis)
      ? SMART_FOLDER_QUERY_KEYS.works(
          getSmartFolderId(nav.activeAxis),
          buildSmartFolderFilterParams(nav.selectedTags),
        )
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
  };

  return { applyPatchSuccess };
}

/** タイトル・ブックマーク・タグ編集を独立した mutation として提供する */
export function useLibraryWorkPatchMutations(nav: LibraryViewState, searchQuery: string) {
  const { applyPatchSuccess } = useWorkPatchMutationContext(nav, searchQuery);

  const titleMutation = useMutation({
    mutationFn: ({ workId, title }: { workId: string; title: string }) =>
      patchWork(workId, { title }),
    onSuccess: (updatedWork, { workId, title }) =>
      applyPatchSuccess(updatedWork, workId, { title }),
  });

  const bookmarkMutation = useMutation({
    mutationFn: ({ workId, bookmarked }: { workId: string; bookmarked: boolean }) =>
      patchWork(workId, { bookmarked }),
    onSuccess: (updatedWork, { workId, bookmarked }) =>
      applyPatchSuccess(updatedWork, workId, { bookmarked }),
  });

  const tagsMutation = useMutation({
    mutationFn: ({ workId, tags }: { workId: string; tags: Work["tags"] }) =>
      patchWork(workId, { tags }),
    onSuccess: (updatedWork, { workId, tags }) => applyPatchSuccess(updatedWork, workId, { tags }),
  });

  return { titleMutation, bookmarkMutation, tagsMutation };
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
