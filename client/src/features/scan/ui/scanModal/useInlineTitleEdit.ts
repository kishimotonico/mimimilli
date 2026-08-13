// 新規登録済み・更新された作品タブ共通: タイトルのインライン編集。
import { useEffect, useRef, useState, type RefObject } from "react";
import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { WorkListItem, WorksPage } from "@mimimilli/shared";
import { getWork, patchWork } from "../../../../entities/work/api";
import { assertWorkSourceRevision } from "../../../../entities/work/sourceRevision";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { apiErrorMessage } from "../../../../shared/lib/apiError";

function patchTitleInWorksPage(
  prev: WorksPage | undefined,
  workId: string,
  title: string,
): WorksPage | undefined {
  if (!prev) return prev;
  return {
    ...prev,
    items: prev.items.map((item) => (item.id === workId ? { ...item, title } : item)),
  };
}

export interface InlineTitleEdit {
  editingId: string | null;
  editTitle: string;
  editSaving: boolean;
  editErrorFor: (workId: string) => string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  startEdit: (work: WorkListItem) => void;
  changeTitle: (title: string) => void;
  saveTitle: (workId: string) => void;
}

/** タイトルのインライン編集state。表示中のWorksPageクエリキャッシュを保存成功時に直接パッチする。 */
export function useInlineTitleEdit(queryKey: QueryKey): InlineTitleEdit {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const saveTitleMutation = useMutation({
    mutationFn: async ({ workId, title }: { workId: string; title: string }) => {
      const work = await getWork(workId);
      return patchWork(workId, {
        title,
        sourceRevision: assertWorkSourceRevision(work.sourceRevision),
      });
    },
    onSuccess: (updatedWork, { workId }) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.detail(workId), updatedWork);
      queryClient.setQueryData<WorksPage>(queryKey, (prev) =>
        patchTitleInWorksPage(prev, workId, updatedWork.title),
      );
      setEditingId(null);
    },
    onError: (_error, { workId }) => {
      void queryClient.invalidateQueries({ queryKey: WORK_QUERY_KEYS.detail(workId) });
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
    ? apiErrorMessage(saveTitleMutation.error, "タイトルの保存に失敗しました")
    : null;

  return {
    editingId,
    editTitle,
    editSaving: saveTitleMutation.isPending,
    editErrorFor: (workId) => (editingId === workId ? editError : null),
    titleInputRef,
    startEdit,
    changeTitle: setEditTitle,
    saveTitle,
  };
}
