import { useEffect, useReducer, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  TagPrefix,
  UrlEntry,
  Work,
  WorkProjection,
  WorkSourceMutationResult,
} from "@mimimilli/shared";
import { ApiRequestError } from "../../../../shared/api/http";
import { getWorkEditSnapshot } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { sourceMutationErrorMessage } from "../../../../entities/work/sourceMutation";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import {
  canSaveWorkEditDraft,
  createWorkEditDraftState,
  deriveWorkEditDirty,
  hasUnresolvedConflicts,
  planWorkEditSave,
  workEditDraftReducer,
} from "../../model/workEditDraft";
import type { WorkEditField } from "../../model/workEditReconcile";
import { interpretWorkEditSaveResult } from "../../model/workEditSaveResult";
import { useWorkEditTagsDraft } from "./useWorkEditTagsDraft";

const SOURCE_CHANGED_MESSAGE = "作品データが他で更新されました。最新の内容を確認しています…";

interface UseWorkEditDraftOptions {
  work: Work;
  editMutation: ReturnType<typeof useLibraryWorkPatchMutations>["editMutation"];
  tagPrefixes: TagPrefix[];
  onClose: () => void;
}

/** 作品編集ダイアログの編集状態（取り込み・競合・dirty・保存・閉じる確認）をReactへつなぐ。
 *  状態遷移そのものは model/workEditDraft.ts の reducer が持つ。 */
export function useWorkEditDraft({
  work,
  editMutation,
  tagPrefixes,
  onClose,
}: UseWorkEditDraftOptions) {
  const queryClient = useQueryClient();
  const sourceQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.source(work.id),
    queryFn: () => getWorkEditSnapshot(work.id),
  });
  const [state, dispatch] = useReducer(workEditDraftReducer, work, createWorkEditDraftState);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // source確定（保存成功）とcatalog反映は別の事実（ADR-0025）。
  // projectionがpendingでも保存自体は成功として扱い、反映状況だけをここに残す。
  const [projection, setProjection] = useState<WorkProjection | null>(null);
  const [focusRequest, setFocusRequest] = useState<{ field: "title" | "urls" } | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const firstUrlInputRef = useRef<HTMLInputElement>(null);

  const dirty = deriveWorkEditDirty(state);
  const tagsDraftOps = useWorkEditTagsDraft({
    tags: state.draft.tags,
    onChange: (tags) => dispatch({ type: "tagsChanged", tags }),
    tagPrefixes,
  });

  // レンダー中に前回値と比較してstateを調整するパターン（useEffectの1tick遅延を避ける）。
  const incoming = sourceQuery.data;
  if (incoming && incoming.sourceRevision !== state.processedRevision) {
    dispatch({ type: "snapshotReceived", snapshot: incoming });
  }

  // 保存中はdisabledでフォーカスがbodyへ落ちるため、失敗確定時にフォーカスを戻す。
  useEffect(() => {
    if (!focusRequest) return;
    const target = focusRequest.field === "title" ? titleInputRef : firstUrlInputRef;
    target.current?.focus();
  }, [focusRequest]);

  const sourceErrorMessage = sourceQuery.error
    ? sourceMutationErrorMessage(sourceQuery.error, "作品情報を読み込めないため編集できません。")
    : null;
  const canEditSource = Boolean(state.accepted) && !sourceQuery.isError;
  const conflictFields: readonly WorkEditField[] = state.pending?.conflictFields ?? [];
  const isBusy = editMutation.isPending || !canEditSource;

  function failSave(cause: unknown) {
    if (cause instanceof ApiRequestError && cause.code === "source_changed") {
      setSaveError(SOURCE_CHANGED_MESSAGE);
      void sourceQuery.refetch().finally(() => {
        setSaveError((current) => (current === SOURCE_CHANGED_MESSAGE ? null : current));
      });
    } else {
      // ApiTransportError（通信断・中断）は他の失敗と区別し、成功とも失敗とも推測しない
      // 「結果を確認できませんでした」文言を出す。draftは書き換えない。
      setSaveError(sourceMutationErrorMessage(cause, "保存できませんでした。"));
    }
    if (dirty.title) setFocusRequest({ field: "title" });
    else if (dirty.urls) setFocusRequest({ field: "urls" });
  }

  const save = async (options: { closeAfterSave: boolean }): Promise<boolean> => {
    // 送信開始時点でタグのundo導線を無効化する（保存を試みた時点で「取り消せる」前提が崩れる）。
    tagsDraftOps.dismissUndo();
    const plan = planWorkEditSave(state);
    if (plan.kind === "invalidUrls") {
      dispatch({ type: "urlValidationFailed", message: plan.message });
      return false;
    }
    if (plan.kind === "blocked") return false;

    try {
      const result = await editMutation.mutateAsync({
        workId: work.id,
        sourceRevision: plan.sourceRevision,
        title: plan.title,
        tags: plan.tags,
        urls: plan.urls,
      });
      const outcome = interpretWorkEditSaveResult(result);
      dispatch({ type: "saved", snapshot: outcome.snapshot });
      setProjection(outcome.projection);
      setSaveError(null);
      if (options.closeAfterSave) onClose();
      return true;
    } catch (cause) {
      failSave(cause);
      return false;
    }
  };

  const requestClose = () => {
    if (dirty.any) {
      setIsUnsavedPromptOpen(true);
      return;
    }
    onClose();
  };

  return {
    title: state.draft.title,
    tags: state.draft.tags,
    urls: state.draft.urls,
    urlValidationError: state.urlValidationError,
    acceptedSnapshot: state.accepted,
    conflictFields,
    isDirty: dirty.any,
    isSaving: editMutation.isPending,
    isBusy,
    canEditSource,
    canSave: canEditSource && canSaveWorkEditDraft(state),
    canSubmit:
      canEditSource && dirty.any && !hasUnresolvedConflicts(state) && !editMutation.isPending,
    saveError,
    sourceErrorMessage,
    projection,
    isUnsavedPromptOpen,
    titleInputRef,
    firstUrlInputRef,
    tagsDraft: tagsDraftOps,
    setTitle: (title: string) => dispatch({ type: "titleChanged", title }),
    setUrls: (urls: UrlEntry[]) => dispatch({ type: "urlsChanged", urls }),
    resolveConflict: (field: WorkEditField, useLatest: boolean) =>
      dispatch({ type: "conflictResolved", field, useLatest }),
    applyProjectedResult: (result: WorkSourceMutationResult) => {
      queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), result.snapshot);
      setProjection(result.projection);
    },
    save,
    saveAndClose: async () => {
      const ok = await save({ closeAfterSave: true });
      if (!ok) setIsUnsavedPromptOpen(false);
    },
    requestClose,
    cancelUnsavedPrompt: () => setIsUnsavedPromptOpen(false),
    discardAndClose: () => {
      setIsUnsavedPromptOpen(false);
      onClose();
    },
  };
}
