// 作品を変更する操作の mutation hook（ADR-0028）。必須キャッシュ更新は hook 定義側の onSuccess が済ませる。
// アンマウント後も必要な画面の後処理（グローバル atom・QueryClient・親コールバック・トースト）は
// mutateAsync を await した後に書き、mutate の呼び出し単位 callback は UI ローカルな state 更新に限る。

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type QueryKey,
  type UseMutationResult,
} from "@tanstack/react-query";
import type {
  DlsiteApplyBody,
  DlsitePreview,
  DlsiteStateUpdateBody,
  NormalizedTag,
  ScanCandidateRegisterItem,
  ScanCandidatesRegisterResponse,
  UnregisterMissingWorksResult,
  UrlEntry,
  WorkCreateBodyInput,
  WorkCreateResponse,
  WorkSourceMutationResult,
  WorkspacePath,
} from "@mimimilli/shared";
import {
  addWorkTag,
  applyDlsiteInfo,
  applyDlsiteMissing,
  createWork,
  deleteWork,
  fetchDlsiteInfo,
  getWorkEditSnapshot,
  patchWorkBookmark,
  patchWorkSource,
  projectWorkSource,
  reassignIdentityConflict,
  registerScanCandidates,
  removeWorkTag,
  unregisterMissingWorks,
  updateDlsiteState,
} from "../api";
import {
  updateCachesAfterBookmark,
  updateCachesAfterDlsiteBulkApply,
  updateCachesAfterDlsiteLinkageChange,
  updateCachesAfterDlsitePreviewFetch,
  updateCachesAfterIdentityReassign,
  updateCachesAfterMissingUnregistration,
  updateCachesAfterRegistration,
  updateCachesAfterSourceEdit,
  updateCachesAfterSourceEditFailure,
  updateCachesAfterUnregistration,
} from "./workCacheUpdates";

/** 一括draft保存（ADR-0025）の変数。未変更のフィールドはキー自体を含めない */
export type EditWorkSourceVariables = {
  workId: string;
  sourceRevision: string;
  title?: string;
  tags?: NormalizedTag[];
  urls?: UrlEntry[];
};
export type WorkTagVariables = { workId: string; tag: string };
export type BookmarkWorkVariables = { workId: string; bookmarked: boolean };

export type EditWorkSourceMutation = UseMutationResult<
  WorkSourceMutationResult,
  Error,
  EditWorkSourceVariables
>;
export type WorkTagMutation = UseMutationResult<WorkSourceMutationResult, Error, WorkTagVariables>;
export type BookmarkWorkMutation = UseMutationResult<
  { bookmarked: boolean },
  Error,
  BookmarkWorkVariables
>;
export type UnregisterWorkMutation = UseMutationResult<void, Error, string>;
export type UnregisterMissingWorksMutation = UseMutationResult<
  UnregisterMissingWorksResult,
  Error,
  void
>;

/** 表示中の一覧を画面が自分で新しい値へ揃える契約。queryKey だけ無効化の対象から外れる */
export interface ActiveListCacheHandler {
  queryKey: QueryKey;
  apply: (
    queryClient: QueryClient,
    change: { workId: string; bookmarked: boolean },
  ) => void | Promise<void>;
}

function useSourceEditMutation<TVariables extends { workId: string }>(
  mutationFn: (variables: TVariables) => Promise<WorkSourceMutationResult>,
): UseMutationResult<WorkSourceMutationResult, Error, TVariables> {
  const queryClient = useQueryClient();
  return useMutation<WorkSourceMutationResult, Error, TVariables>({
    mutationFn,
    onSuccess: (result) => updateCachesAfterSourceEdit(queryClient, result),
    onError: (_error, { workId }) => updateCachesAfterSourceEditFailure(queryClient, workId),
  });
}

export function useEditWorkSourceMutation(): EditWorkSourceMutation {
  return useSourceEditMutation<EditWorkSourceVariables>(
    ({ workId, sourceRevision, title, tags, urls }) =>
      patchWorkSource(workId, { sourceRevision, title, tags, urls }),
  );
}

/** 編集基準を持たない画面向け。保存直前に最新の sourceRevision を取得して上書きする */
export function useRenameWorkMutation() {
  return useSourceEditMutation<{ workId: string; title: string }>(async ({ workId, title }) => {
    const snapshot = await getWorkEditSnapshot(workId);
    return patchWorkSource(workId, { title, sourceRevision: snapshot.sourceRevision });
  });
}

export function useAddWorkTagMutation(): WorkTagMutation {
  return useSourceEditMutation<WorkTagVariables>(({ workId, tag }) => addWorkTag(workId, tag));
}

export function useRemoveWorkTagMutation(): WorkTagMutation {
  return useSourceEditMutation<WorkTagVariables>(({ workId, tag }) => removeWorkTag(workId, tag));
}

export function useProjectWorkSourceMutation() {
  const queryClient = useQueryClient();
  return useMutation<WorkSourceMutationResult, Error, WorkspacePath>({
    mutationFn: (path) => projectWorkSource(path),
    onSuccess: (result) => updateCachesAfterSourceEdit(queryClient, result),
  });
}

export function useBookmarkWorkMutation(options?: {
  activeList?: ActiveListCacheHandler | null;
}): BookmarkWorkMutation {
  const queryClient = useQueryClient();
  const activeList = options?.activeList ?? null;
  return useMutation<{ bookmarked: boolean }, Error, BookmarkWorkVariables>({
    mutationFn: ({ workId, bookmarked }) => patchWorkBookmark(workId, { bookmarked }),
    onSuccess: async (result, { workId }) => {
      const change = { workId, bookmarked: result.bookmarked };
      await activeList?.apply(queryClient, change);
      await updateCachesAfterBookmark(queryClient, change, activeList?.queryKey ?? null);
    },
    onError: (_error, { workId }) => updateCachesAfterSourceEditFailure(queryClient, workId),
  });
}

export function useRegisterWorkMutation() {
  const queryClient = useQueryClient();
  return useMutation<WorkCreateResponse, Error, WorkCreateBodyInput>({
    mutationFn: (body) => createWork(body),
    onSuccess: () => updateCachesAfterRegistration(queryClient),
  });
}

export function useRegisterScanCandidatesMutation() {
  const queryClient = useQueryClient();
  return useMutation<ScanCandidatesRegisterResponse, Error, ScanCandidateRegisterItem[]>({
    mutationFn: (items) => registerScanCandidates(items),
    onSuccess: () => updateCachesAfterRegistration(queryClient),
  });
}

export function useUnregisterWorkMutation(): UnregisterWorkMutation {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: (workId) => deleteWork(workId),
    onSuccess: (_data, workId) => updateCachesAfterUnregistration(queryClient, workId),
  });
}

export function useUnregisterMissingWorksMutation(): UnregisterMissingWorksMutation {
  const queryClient = useQueryClient();
  return useMutation<UnregisterMissingWorksResult, Error, void>({
    mutationFn: () => unregisterMissingWorks(),
    onSuccess: () => updateCachesAfterMissingUnregistration(queryClient),
  });
}

export function useReassignWorkIdentityMutation() {
  const queryClient = useQueryClient();
  return useMutation<WorkSourceMutationResult, Error, WorkspacePath>({
    mutationFn: (path) => reassignIdentityConflict(path),
    onSuccess: (result) => updateCachesAfterIdentityReassign(queryClient, result),
  });
}

export function useUpdateDlsiteLinkageMutation() {
  const queryClient = useQueryClient();
  return useMutation<
    WorkSourceMutationResult,
    Error,
    { workId: string; body: DlsiteStateUpdateBody }
  >({
    mutationFn: ({ workId, body }) => updateDlsiteState(workId, body),
    onSuccess: (result) => updateCachesAfterDlsiteLinkageChange(queryClient, result),
  });
}

export function useFetchDlsitePreviewMutation() {
  const queryClient = useQueryClient();
  return useMutation<DlsitePreview, Error, string>({
    mutationFn: (workId) => fetchDlsiteInfo(workId),
    onSettled: (_data, _error, workId) => updateCachesAfterDlsitePreviewFetch(queryClient, workId),
  });
}

export function useApplyDlsiteInfoMutation() {
  const queryClient = useQueryClient();
  return useMutation<WorkSourceMutationResult, Error, { workId: string; body: DlsiteApplyBody }>({
    mutationFn: ({ workId, body }) => applyDlsiteInfo(workId, body),
    onSuccess: (result) => updateCachesAfterDlsiteLinkageChange(queryClient, result),
  });
}

export function useApplyDlsiteMissingMutation() {
  const queryClient = useQueryClient();
  return useMutation<Awaited<ReturnType<typeof applyDlsiteMissing>>, Error, string[]>({
    mutationFn: (workIds) => applyDlsiteMissing(workIds),
    onSuccess: (_result, workIds) => updateCachesAfterDlsiteBulkApply(queryClient, workIds),
  });
}
