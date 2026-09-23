// 新規登録済み・更新された作品タブ共通: タイトルのインライン編集。
import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type {
  WorkListItem,
  WorkProjection,
  WorkSourceMutationResult,
  WorkspacePath,
} from "@mimimilli/shared";
import { getWorkEditSnapshot, patchWorkSource } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import {
  sourceMutationErrorMessage,
  projectionWorkspacePath,
} from "../../../../entities/work/sourceMutation";
import { useRootFolderOrNull } from "../../../../entities/settings/useSettingsQuery";

export interface InlineTitleEdit {
  editingId: string | null;
  editTitle: string;
  editSaving: boolean;
  editErrorFor: (workId: string) => string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  startEdit: (work: WorkListItem) => void;
  changeTitle: (title: string) => void;
  saveTitle: (workId: string) => void;
  /** Escapeでの取り消し。保存はせず編集モードだけを閉じる。 */
  cancelEdit: () => void;
  projection: WorkProjection | null;
  projectionPath: WorkspacePath | null;
  applyProjected: (result: WorkSourceMutationResult) => void;
}

/** タイトルのインライン編集state。保存成功時は source キャッシュを更新し、一覧は invalidate する。 */
export function useInlineTitleEdit(queryKey: QueryKey): InlineTitleEdit {
  const queryClient = useQueryClient();
  const rootFolder = useRootFolderOrNull();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pendingResult, setPendingResult] = useState<WorkSourceMutationResult | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const saveTitleMutation = useMutation({
    mutationFn: async ({ workId, title }: { workId: string; title: string }) => {
      const snapshot = await getWorkEditSnapshot(workId);
      return patchWorkSource(workId, {
        title,
        sourceRevision: snapshot.sourceRevision,
      });
    },
    onSuccess: (result, { workId }) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.source(workId), result.snapshot);
      void queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId), exact: true });
      void queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setPendingResult(result.projection.status === "pending" ? result : null);
    },
    onError: (_error, { workId }) => {
      void queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId), exact: true });
    },
  });

  useEffect(() => {
    if (!editingId) return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [editingId]);

  const startEdit = (work: WorkListItem) => {
    setEditingId(work.id);
    setEditTitle(work.title);
    saveTitleMutation.reset();
  };

  const saveTitle = (workId: string) => {
    if (saveTitleMutation.isPending) return;
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setEditingId(null);
      saveTitleMutation.reset();
      return;
    }
    saveTitleMutation.mutate({ workId, title: trimmed });
  };

  const editError = saveTitleMutation.error
    ? sourceMutationErrorMessage(saveTitleMutation.error, "タイトルの保存に失敗しました")
    : null;

  const cancelEdit = () => {
    setEditingId(null);
    saveTitleMutation.reset();
  };

  return {
    editingId,
    editTitle,
    editSaving: saveTitleMutation.isPending,
    editErrorFor: (workId) => (editingId === workId ? editError : null),
    titleInputRef,
    startEdit,
    changeTitle: setEditTitle,
    saveTitle,
    cancelEdit,
    projection: pendingResult?.projection ?? null,
    projectionPath:
      pendingResult && rootFolder
        ? projectionWorkspacePath(pendingResult.snapshot, rootFolder)
        : null,
    applyProjected: (result) => {
      setPendingResult(result.projection.status === "pending" ? result : null);
    },
  };
}
