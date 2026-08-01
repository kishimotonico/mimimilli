// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type SmartFolderCreate,
  type Work,
  type WorkPatch,
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

export function useLibraryQueries(nav: LibraryViewState, searchQuery: string) {
  const queryClient = useQueryClient();

  // 検索語はデバウンスしてから queryKey・パラメータに使う（空文字へのクリアは即時反映）
  const debouncedSearchQuery = useDebouncedValue(
    searchQuery,
    SEARCH_DEBOUNCE_MS,
    searchQuery === "",
  );

  // ── Works（通常軸 / スマートフォルダー軸）─────────────────
  const worksParams = buildWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery: debouncedSearchQuery,
    selectedTags: nav.selectedTags,
    drillValue: nav.drillValue,
  });

  // ── Works（通常軸 / スマートフォルダー軸）─────────────────
  // 通常一覧はページ蓄積（追加読み込み）。randomソートは初回レスポンスのseedを
  // pageParam 経由で次ページへ引き継ぎ、ページ間の重複・欠落を防ぐ（TASK-73）
  const worksQuery = useInfiniteQuery({
    queryKey: WORK_QUERY_KEYS.list(worksParams ?? {}),
    queryFn: ({ pageParam, signal }) =>
      searchWorks(
        {
          ...worksParams!,
          page: pageParam.page,
          limit: WORKS_DEFAULT_PAGE_SIZE,
          seed: pageParam.seed,
        },
        { signal },
      ),
    initialPageParam: { page: 1, seed: undefined } as WorksPageParam,
    getNextPageParam: (lastPage, allPages, lastPageParam): WorksPageParam | undefined => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.items.length, 0);
      if (lastPage.items.length === 0 || loadedCount >= lastPage.total) return undefined;
      return { page: lastPageParam.page + 1, seed: lastPage.seed ?? lastPageParam.seed };
    },
    enabled: worksParams !== null,
  });

  const smartAxisId = isSmartAxis(nav.activeAxis) ? getSmartFolderId(nav.activeAxis) : null;

  // スマートフォルダー軸もページ蓄積。random ソート時は seed を次ページへ引き継ぐ（TASK-74）
  const smartWorksQuery = useInfiniteQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.works(smartAxisId ?? ""),
    queryFn: ({ pageParam, signal }) =>
      evalSmartFolder(
        smartAxisId!,
        {
          page: pageParam.page,
          limit: WORKS_DEFAULT_PAGE_SIZE,
          seed: pageParam.seed,
        },
        { signal },
      ),
    initialPageParam: { page: 1, seed: undefined } as WorksPageParam,
    getNextPageParam: (lastPage, allPages, lastPageParam): WorksPageParam | undefined => {
      const loadedCount = allPages.reduce((sum, page) => sum + page.items.length, 0);
      if (lastPage.items.length === 0 || loadedCount >= lastPage.total) return undefined;
      return { page: lastPageParam.page + 1, seed: lastPage.seed ?? lastPageParam.seed };
    },
    enabled: smartAxisId !== null,
  });

  const works = isSmartAxis(nav.activeAxis)
    ? (smartWorksQuery.data?.pages.flatMap((page) => page.items) ?? [])
    : (worksQuery.data?.pages.flatMap((page) => page.items) ?? []);
  const isLoading = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isPending : worksQuery.isPending;
  const isError = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isError : worksQuery.isError;
  const hasNextPage = isSmartAxis(nav.activeAxis)
    ? (smartWorksQuery.hasNextPage ?? false)
    : (worksQuery.hasNextPage ?? false);
  const isFetchingNextPage = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.isFetchingNextPage
    : worksQuery.isFetchingNextPage;
  const fetchNextPage = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.fetchNextPage
    : worksQuery.fetchNextPage;
  const worksTotal = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.data?.pages[smartWorksQuery.data.pages.length - 1]?.total
    : (worksQuery.data?.pages[worksQuery.data.pages.length - 1]?.total ?? undefined);
  // stats（トラック数・再生時間の合計）は絞り込み後・ページング前の集合に対する値なので
  // どのページのレスポンスでも同じ。worksTotal と同じく最新ページから取り出す。
  const worksStats = isSmartAxis(nav.activeAxis)
    ? smartWorksQuery.data?.pages[smartWorksQuery.data.pages.length - 1]?.stats
    : worksQuery.data?.pages[worksQuery.data.pages.length - 1]?.stats;

  // ── ライブラリ総件数 ──────────────────────────────────────
  const libraryTotalQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.total(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });

  // ── ファセット items ──────────────────────────────────────
  const facetAxis = getFacetAxisForQuery(nav.activeAxis, nav.drillValue);

  const facetQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.facets(facetAxis ?? ""),
    queryFn: () => getAxisFacets(facetAxis!),
    enabled: facetAxis !== null,
  });

  // ── スマートフォルダー一覧 ────────────────────────────────
  const smartFoldersQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.all(),
    queryFn: listSmartFolders,
  });
  const smartFolders = smartFoldersQuery.data ?? [];

  // ── 選択中作品の詳細 ──────────────────────────────────────
  const workDetailQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.detail(nav.selectedWorkId ?? ""),
    queryFn: () => getWork(nav.selectedWorkId!),
    enabled: nav.selectedWorkId !== null,
  });
  const selectedWork = workDetailQuery.data ?? null;

  const tagsQuery = useQuery({
    queryKey: TAG_QUERY_KEYS.all(),
    queryFn: getAllTags,
  });

  const {
    tagPrefixes,
    isError: isTagPrefixesError,
    refetch: refetchTagPrefixes,
  } = useTagPrefixes();

  // 作品一覧の再試行（isError 時のリトライ導線用）。表示中の軸に応じて実クエリを切り替える。
  const refetchWorks = isSmartAxis(nav.activeAxis) ? smartWorksQuery.refetch : worksQuery.refetch;

  // ── 作品PATCH mutation ────────────────────────────────────
  // 変更フィールドに応じて再取得範囲を絞る（getWorkPatchInvalidationTargets 参照）。
  // 詳細は返却された updatedWork を正として setQueryData するのみで invalidate はしない
  // （直前まで invalidate も併用しており二重再取得になっていた）。
  // ただし detail キャッシュは丸ごと置き換えず mergeWorkPatchResponse で body が
  // 実際に指定したフィールドだけを取り込む（resume が高頻度更新のため PATCH と
  // 別エンドポイントに分離されている契約を守り、無関係なPATCHで再生位置の
  // 表示が予告なく飛ぶのを防ぐ。詳細は mergeWorkPatchResponse のコメント参照）。
  const patchWorkMutation = useMutation({
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
      const listItem = workToListItem(updatedWork);
      const onSmartAxis = isSmartAxis(nav.activeAxis);
      const activeListQueryKey = onSmartAxis
        ? SMART_FOLDER_QUERY_KEYS.works(getSmartFolderId(nav.activeAxis))
        : worksParams !== null
          ? WORK_QUERY_KEYS.list(worksParams)
          : null;

      if (targets.patchActiveListCache && activeListQueryKey !== null) {
        patchWorkInQueryCache(queryClient, activeListQueryKey, workId, listItem);
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

  return {
    works,
    worksParams,
    isLoading,
    isError,
    hasNextPage,
    worksTotal,
    worksStats,
    isFetchingNextPage,
    fetchNextPage,
    refetchWorks,
    libraryTotal: libraryTotalQuery.data,
    facetItems: facetQuery.data ?? [],
    // facetQuery は works クエリと別系統。作品一覧の isLoading/isError をタグ・ファセット軸の
    // 見出し／本文に流用すると、軸切替時に片方だけ先に解決して見出しと本文が食い違う
    // （R2: 直前軸の件数見出し固着調査で判明）ため、facetQuery 自身の状態を別出しする
    isFacetLoading: facetQuery.isLoading,
    isFacetError: facetQuery.isError,
    refetchFacets: facetQuery.refetch,
    smartFolders,
    selectedWork,
    workDetailQuery,
    tagSuggestions: tagsQuery.data ?? [],
    tagPrefixes,
    isTagPrefixesError,
    refetchTagPrefixes,
    patchWorkMutation,
  };
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
