// 新規登録済み・更新された作品タブ共通: タイトルのインライン編集。
import { useEffect, useRef, useState, type RefObject } from "react";
import type {
  WorkListItem,
  WorkProjection,
  WorkSourceMutationResult,
  WorkspacePath,
} from "@mimimilli/shared";
import { useRenameWorkMutation } from "../../../../entities/work/model/workMutations";
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

/** タイトルのインライン編集state */
export function useInlineTitleEdit(): InlineTitleEdit {
  const rootFolder = useRootFolderOrNull();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pendingResult, setPendingResult] = useState<WorkSourceMutationResult | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const saveTitleMutation = useRenameWorkMutation();

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
    saveTitleMutation.mutate(
      { workId, title: trimmed },
      {
        onSuccess: (result) => {
          setEditingId(null);
          setPendingResult(result.projection.status === "pending" ? result : null);
        },
      },
    );
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
