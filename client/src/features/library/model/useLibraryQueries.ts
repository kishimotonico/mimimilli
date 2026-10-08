// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseInfiniteQuery,
} from "@tanstack/react-query";
import { useState } from "react";
import { useAtomValue } from "jotai";
import { randomSeedAtom } from "./atoms";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderRule,
  type WorksPage,
} from "@mimimilli/shared";
import { searchWorks } from "../../../entities/work/api";
import {
  listSmartFolders,
  createSmartFolder,
  updateSmartFolder,
  deleteSmartFolder,
  evalSmartFolder,
  previewSmartFolderRuleCount,
} from "../../../entities/smart-folder/api";
import { allTagsQueryOptions } from "../../../entities/tag/allTagsQueryOptions";
import { workDetailQueryOptions } from "../../../entities/work/workDetailQueryOptions";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { invalidateSmartFolderSaveQueries } from "./smartFolderInvalidation";
import {
  buildSmartFolderFilterParams,
  buildNormalWorksParams,
  buildWorksParams,
  computeCollectionStatsDisplay,
  getFacetAxisForQuery,
} from "./libraryPresentation";
import { useTagPrefixes } from "../../../entities/tag/useTagPrefixes";
import { useAxisFacetsQuery } from "./useAxisFacetsQuery";
import { useDebouncedValue } from "../../../shared/lib/useDebouncedValue";
import {
  useAddWorkTagMutation,
  useBookmarkWorkMutation,
  useEditWorkSourceMutation,
  useRemoveWorkTagMutation,
} from "../../../entities/work/model/workMutations";
import { bookmarkActiveListHandler, smartOrWorksListKey } from "./workPatchInvalidation";
import { getSmartFolderId } from "../../../entities/library/axisDefinitions";
import type { LibraryViewState } from "./useLibraryNavigation";

/** 検索クエリのデバウンス時間。1文字ごとの全件検索発行を間引く */
const SEARCH_DEBOUNCE_MS = 250;

import { libraryTotalQueryOptions } from "../../../entities/work/libraryTotalQueryOptions";
import { errorViewCountQueryOptions } from "../../../entities/work/errorViewCountQueryOptions";
import { missingWorksCountQueryOptions } from "../../../entities/work/missingWorksCountQueryOptions";
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
  const randomSeed = useAtomValue(randomSeedAtom);
  // 呼び出し側は通常軸だけをマウントする。スマート軸は専用の子コンポーネントが担当する。
  const normalWorksParams = buildNormalWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery,
    selectedTags: nav.selectedTags,
    randomSeed,
  });

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
    initialPageParam: { page: 1, seed: normalWorksParams.seed } as WorksPageParam,
    getNextPageParam: getNextWorksPageParam,
  });
  return toSuspenseWorksResult(query);
}

/** 作品クエリのキーに渡す検索語。Suspense境界の外で維持して連続入力を間引く。 */
export function useLibraryDebouncedSearchQuery(searchQuery: string) {
  return useDebouncedValue(searchQuery, SEARCH_DEBOUNCE_MS, searchQuery === "");
}

/** Suspense 境界配下でのみ使うスマートフォルダー作品一覧。
 *  保持中のタグ/組み込み軸フィルタと作品検索 q を、フォルダーのルール（OR・除外を含む）
 *  全体への追加 AND として渡す（ADR-0012）。sort はフォルダー自身が保持し、
 *  この評価APIへは渡さない（LibrarySortMenu 参照）。 */
export function useSuspenseSmartLibraryWorks(nav: LibraryViewState, searchQuery: string) {
  const smartAxisId = getSmartFolderId(nav.activeAxis);
  const filterParams = buildSmartFolderFilterParams(nav.selectedTags, searchQuery);
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
  return toSuspenseWorksResult(query);
}

function toSuspenseWorksResult(query: {
  data: { pages: WorksPage[] };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
  refetch: () => Promise<unknown>;
}) {
  const lastPage = query.data.pages[query.data.pages.length - 1];
  return {
    works: query.data.pages.flatMap((page) => page.items),
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
  const errorViewCountQuery = useQuery(errorViewCountQueryOptions);
  const facetAxis = getFacetAxisForQuery(nav.activeAxis);
  // 結果面の値一覧（AxisValueList）は既定=置き換えの入口（ADR-0013）なので、件数基準は
  // 無条件集計にする（主クリックの結果＝選択タグを丸ごと置き換えた後の件数と一致させる）。
  const facetQuery = useAxisFacetsQuery(facetAxis, []);
  const smartFoldersQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
  });
  const workDetailQuery = useQuery(workDetailQueryOptions(nav.selectedWorkId));
  const tagsQuery = useQuery(allTagsQueryOptions);
  const {
    tagPrefixes,
    isError: isTagPrefixesError,
    refetch: refetchTagPrefixes,
  } = useTagPrefixes();

  return {
    libraryTotal: libraryStatsQuery.data?.total,
    errorViewCount: errorViewCountQuery.data?.total,
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

/** 編集ダイアログの一括保存（title・tags・urls）・ブックマーク・詳細ペイン常駐タグの
 *  意図コマンドを独立した mutation として提供する。ブックマークだけは表示中の一覧を
 *  画面側で揃え、その一覧の再取得を省く */
export function useLibraryWorkPatchMutations(nav: LibraryViewState, searchQuery: string) {
  const randomSeed = useAtomValue(randomSeedAtom);
  const debouncedSearchQuery = useLibraryDebouncedSearchQuery(searchQuery);
  const worksParams = buildWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery: debouncedSearchQuery,
    selectedTags: nav.selectedTags,
    randomSeed,
  });
  const activeListQueryKey = smartOrWorksListKey(nav, worksParams, debouncedSearchQuery);

  const editMutation = useEditWorkSourceMutation();
  const bookmarkMutation = useBookmarkWorkMutation({
    activeList: bookmarkActiveListHandler(nav, activeListQueryKey),
  });
  const addTagMutation = useAddWorkTagMutation();
  const removeTagMutation = useRemoveWorkTagMutation();

  return { editMutation, bookmarkMutation, addTagMutation, removeTagMutation };
}

/** エラービュー表示中だけ、missing件数を取得する（一括登録解除の導線・確認ダイアログ用） */
export function useMissingWorksCountQuery(enabled: boolean) {
  return useQuery({ ...missingWorksCountQueryOptions, enabled });
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
      await invalidateSmartFolderSaveQueries(queryClient, savedFolder.id);
      callbacks.onSaved(savedFolder, folder === null);
    },
    onError: (error, { folder }) => {
      callbacks.onError(folder === null, error);
    },
  });
}

// setSmartFolderEditor / nav.setAxis は LibraryView 側の UI state のため、
// 成功時コールバックとして呼び出し側から渡してもらう。
export function useSmartFolderDeleteMutation(callbacks: { onDeleted: () => void }) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteSmartFolder(id),
    onSuccess: async (_result, id) => {
      await invalidateSmartFolderSaveQueries(queryClient, id);
      callbacks.onDeleted();
    },
  });
}

/** ライブ件数プレビュー（保存前ルールの評価API）。300msデバウンス後に問い合わせ、
 *  デバウンス待ち・取得中は isCounting=true を返す。rules が null（ルールが妥当でない）間は
 *  問い合わせない */
const SMART_FOLDER_PREVIEW_DEBOUNCE_MS = 300;

export function useSmartFolderRuleMatchCountQuery(
  rules: SmartFolderRule[] | null,
  options?: { immediate?: boolean },
) {
  const rulesKey = rules ? JSON.stringify(rules) : null;
  // rules は毎レンダー新規参照になりうるため、内容（rulesKey）が変わったときだけ差し替える
  const [stableRules, setStableRules] = useState({ key: rulesKey, rules });
  if (stableRules.key !== rulesKey) setStableRules({ key: rulesKey, rules });
  const debounced = useDebouncedValue(
    stableRules,
    SMART_FOLDER_PREVIEW_DEBOUNCE_MS,
    rulesKey === null || (options?.immediate ?? false),
  );
  const debouncedRules = debounced.rules;

  // debouncedRules が null（条件が妥当でない）のときも一意なキーにする。null を [] に潰すと
  // 「条件0件（＝全作品に一致する妥当な状態）」のキャッシュと衝突し、無効な間も直前の件数が
  // 表示され続けてしまう
  const query = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.preview(debouncedRules ?? { invalid: true }),
    queryFn:
      debouncedRules === null
        ? skipToken
        : ({ signal }) => previewSmartFolderRuleCount(debouncedRules, { signal }),
  });

  return {
    // 無効な間は同じキーに紐づくキャッシュが万一残っていても参照しない
    total: debouncedRules === null ? undefined : query.data,
    isCounting: debouncedRules !== null && (rulesKey !== debounced.key || query.isFetching),
  };
}
