// LibraryView が使う query 群・mutation 群の集約。
// LibraryView.tsx にあった6系統の query と2つの mutation をここへ移し、
// コンポーネント側は返された view model を配線するだけにする。

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSetAtom } from "jotai";
import type { SmartFolder, SmartFolderCreate, WorkPatch } from "@mimimilli/shared";
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
import { tagPrefixesAtom } from "./atoms";
import { LIBRARY_KEYS } from "./queryKeys";
import { buildWorksParams, getFacetAxisForQuery } from "./libraryPresentation";
import { getWorkPatchInvalidationTargets } from "./workPatchInvalidation";
import { isSmartAxis, getSmartFolderId } from "./axisDefinitions";
import type { LibraryViewState } from "./useLibraryNavigation";

export function useLibraryQueries(nav: LibraryViewState, searchQuery: string) {
  const queryClient = useQueryClient();

  // ── Works（通常軸 / スマートフォルダー軸）─────────────────
  const worksParams = buildWorksParams({
    activeAxis: nav.activeAxis,
    sort: nav.sort,
    searchQuery,
    selectedTags: nav.selectedTags,
    drillValue: nav.drillValue,
  });

  const worksQuery = useQuery({
    queryKey: LIBRARY_KEYS.works(worksParams ?? {}),
    queryFn: () => searchWorks(worksParams!),
    enabled: worksParams !== null,
  });

  const smartAxisId = isSmartAxis(nav.activeAxis) ? getSmartFolderId(nav.activeAxis) : null;

  const smartWorksQuery = useQuery({
    queryKey: LIBRARY_KEYS.smartFolderWorks(smartAxisId ?? ""),
    queryFn: () => evalSmartFolder(smartAxisId!),
    enabled: smartAxisId !== null,
  });

  const works = isSmartAxis(nav.activeAxis)
    ? (smartWorksQuery.data ?? [])
    : (worksQuery.data?.items ?? []);
  const isLoading = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isPending : worksQuery.isPending;
  const isError = isSmartAxis(nav.activeAxis) ? smartWorksQuery.isError : worksQuery.isError;

  // ── ライブラリ総件数 ──────────────────────────────────────
  const libraryTotalQuery = useQuery({
    queryKey: LIBRARY_KEYS.libraryTotal(),
    queryFn: () => searchWorks({ limit: 1 }).then((page) => page.total),
  });

  // ── ファセット items ──────────────────────────────────────
  const facetAxis = getFacetAxisForQuery(nav.activeAxis, nav.drillValue);

  const facetQuery = useQuery({
    queryKey: LIBRARY_KEYS.facets(facetAxis ?? ""),
    queryFn: () => getAxisFacets(facetAxis!),
    enabled: facetAxis !== null,
  });

  // ── スマートフォルダー一覧 ────────────────────────────────
  const smartFoldersQuery = useQuery({
    queryKey: LIBRARY_KEYS.smartFolders(),
    queryFn: listSmartFolders,
  });
  const smartFolders = smartFoldersQuery.data ?? [];

  // ── 選択中作品の詳細 ──────────────────────────────────────
  const workDetailQuery = useQuery({
    queryKey: LIBRARY_KEYS.workDetail(nav.selectedWorkId ?? ""),
    queryFn: () => getWork(nav.selectedWorkId!),
    enabled: nav.selectedWorkId !== null,
  });
  const selectedWork = workDetailQuery.data ?? null;

  const tagsQuery = useQuery({
    queryKey: LIBRARY_KEYS.tags(),
    queryFn: getAllTags,
  });

  // ── タグ prefix 定義（ADR-0005）──────────────────────────
  // 軸レール・タグチップ表示・保護判定の元データ。atom へ同期し、
  // query を持たない場所（アドレスバー等の派生 atom）からも参照できるようにする。
  const tagPrefixesQuery = useQuery({
    queryKey: LIBRARY_KEYS.tagPrefixes(),
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
      queryClient.setQueryData(LIBRARY_KEYS.workDetail(workId), updatedWork);
      const targets = getWorkPatchInvalidationTargets(body);
      await Promise.all([
        targets.works ? queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allWorks() }) : null,
        targets.facets
          ? queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allFacets() })
          : null,
        targets.smartFolderWorks
          ? queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allSmartFolderWorks() })
          : null,
        targets.tags ? queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.tags() }) : null,
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
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.smartFolders() }),
        queryClient.invalidateQueries({ queryKey: LIBRARY_KEYS.allSmartFolderWorks() }),
      ]);
      callbacks.onSaved(savedFolder, folder === null);
    },
    onError: (error, { folder }) => {
      callbacks.onError(folder === null, error);
    },
  });
}
