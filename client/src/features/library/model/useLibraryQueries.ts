// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import { useEffect } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type SmartFolderCreate,
  type WorkPatch,
} from "@mimimilli/shared";
import {
  searchWorks,
  getAxisFacets,
  listSmartFolders,
  createSmartFolder,
  updateSmartFolder,
  evalSmartFolder,
  listTagPrefixes,
} from "../api";
import { getAllTags, getWork, patchWork } from "../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../../entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../../entities/tag/queryKeys";
import { tagPrefixesAtom } from "./atoms";
import { buildWorksParams, getFacetAxisForQuery } from "./libraryPresentation";
import { useDebouncedValue } from "../../../shared/lib/useDebouncedValue";
import { getWorkPatchInvalidationTargets } from "./workPatchInvalidation";
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

  const smartWorksQuery = useQuery({
    queryKey: SMART_FOLDER_QUERY_KEYS.works(smartAxisId ?? ""),
    queryFn: () => evalSmartFolder(smartAxisId!),
    enabled: smartAxisId !== null,
  });

  const works = isSmartAxis(nav.activeAxis)
    ? (smartWorksQuery.data ?? [])
    : (worksQuery.data?.pages.flatMap((page) => page.items) ?? []);
  const isLoading = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isPending : worksQuery.isPending;
  const isError = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isError : worksQuery.isError;
  // スマートフォルダー軸のページングは TASK-74 で扱う（通常一覧のみ追加読み込み）
  const hasNextPage = !isSmartAxis(nav.activeAxis) && (worksQuery.hasNextPage ?? false);
  const pages = worksQuery.data?.pages;
  const worksTotal = pages ? pages[pages.length - 1]?.total : undefined;

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

  // ── タグ prefix 定義（ADR-0005）──────────────────────────
  // 軸レール・タグチップ表示・保護判定の元データ。atom へ同期し、
  // query を持たない場所（アドレスバー等の派生 atom）からも参照できるようにする。
  const tagPrefixesQuery = useQuery({
    queryKey: TAG_QUERY_KEYS.prefixes(),
    queryFn: listTagPrefixes,
  });
  const setTagPrefixes = useSetAtom(tagPrefixesAtom);
  const tagPrefixes = tagPrefixesQuery.data ?? [];
  useEffect(() => {
    if (tagPrefixesQuery.data) setTagPrefixes(tagPrefixesQuery.data);
  }, [tagPrefixesQuery.data, setTagPrefixes]);

  // ── 作品PATCH mutation ────────────────────────────────────
  // 変更フィールドに応じて再取得範囲を絞る（getWorkPatchInvalidationTargets 参照）。
  // 詳細は返却された updatedWork を正として setQueryData するのみで invalidate はしない
  // （直前まで invalidate も併用しており二重再取得になっていた）。
  const patchWorkMutation = useMutation({
    mutationFn: ({ workId, body }: { workId: string; body: WorkPatch }) => patchWork(workId, body),
    onSuccess: async (updatedWork, { workId, body }) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.detail(workId), updatedWork);
      const targets = getWorkPatchInvalidationTargets(body);
      await Promise.all([
        targets.works ? queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.all() }) : null,
        targets.facets
          ? queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.allFacets() })
          : null,
        targets.smartFolderWorks
          ? queryClient.invalidateQueries({ queryKey: SMART_FOLDER_QUERY_KEYS.allWorks() })
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
    isLoading,
    isError,
    hasNextPage,
    worksTotal,
    isFetchingNextPage: worksQuery.isFetchingNextPage,
    fetchNextPage: worksQuery.fetchNextPage,
    libraryTotal: libraryTotalQuery.data,
    facetItems: facetQuery.data ?? [],
    smartFolders,
    selectedWork,
    workDetailQuery,
    tagSuggestions: tagsQuery.data ?? [],
    tagPrefixes,
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
