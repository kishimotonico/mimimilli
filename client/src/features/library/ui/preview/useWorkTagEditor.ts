import { useState } from "react";
import { normalizeTag, tagEquals } from "@mimimilli/shared";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { isProtectedTag } from "../../../../entities/tag/isProtectedTag";
import type { WorkTagMutation } from "../../../../entities/work/model/workMutations";

export interface UseWorkTagEditorOptions {
  workId: string;
  tags: NormalizedTag[];
  tagSuggestions: string[];
  /** 保護判定（protected な prefix のタグは削除前に確認を挟む。ADR-0005） */
  tagPrefixes: TagPrefix[];
  addTagMutation: WorkTagMutation;
  removeTagMutation: WorkTagMutation;
}

export interface UseWorkTagEditorResult {
  tags: NormalizedTag[];
  suggestions: string[];
  isTagSaving: boolean;
  patchTagsError: WorkTagMutation["error"];
  pendingRemoveTag: NormalizedTag | null;
  failedRemoveTag: NormalizedTag | null;
  /** 保護タグの削除確認待ち。ConfirmDialog の表示トリガー */
  confirmingRemoveTag: NormalizedTag | null;
  tagUndoToast: NormalizedTag | null;
  addTag: (tag: string) => Promise<void>;
  /** 削除要求。保護タグなら確認待ちにし、それ以外は即削除する */
  requestRemoveTag: (tag: NormalizedTag) => Promise<void>;
  confirmRemoveTag: () => Promise<void>;
  cancelRemoveTag: () => void;
  undoRemoveTag: () => Promise<void>;
  dismissTagUndoToast: () => void;
  resetPatchTagsError: () => void;
}

/**
 * タグの追加・削除・削除の undo（トースト経由）と、保護タグの削除確認をまとめて扱うフック。
 * 全タグが編集対象（ADR-0005）。undo は削除したタグをもう一度 PUT する。
 */
export function useWorkTagEditor({
  workId,
  tags,
  tagSuggestions,
  tagPrefixes,
  addTagMutation,
  removeTagMutation,
}: UseWorkTagEditorOptions): UseWorkTagEditorResult {
  const [pendingRemoveTag, setPendingRemoveTag] = useState<NormalizedTag | null>(null);
  const [failedRemoveTag, setFailedRemoveTag] = useState<NormalizedTag | null>(null);
  const [confirmingRemoveTag, setConfirmingRemoveTag] = useState<NormalizedTag | null>(null);
  const [tagUndoToast, setTagUndoToast] = useState<NormalizedTag | null>(null);

  const isSaving = addTagMutation.isPending || removeTagMutation.isPending;

  const addTag = async (tag: string) => {
    const normalized = normalizeTag(tag);
    if (!normalized) return;
    if (tags.some((existing) => tagEquals(existing, normalized))) return;
    if (isSaving) return;
    addTagMutation.reset();
    removeTagMutation.reset();
    try {
      await addTagMutation.mutateAsync({ workId, tag: normalized });
    } catch {
      /* エラーは mutation.error で表示する */
    }
  };

  const removeTag = async (tag: NormalizedTag) => {
    if (isSaving) return;
    setPendingRemoveTag(tag);
    setFailedRemoveTag(null);
    addTagMutation.reset();
    removeTagMutation.reset();
    try {
      await removeTagMutation.mutateAsync({ workId, tag });
      setPendingRemoveTag(null);
      setTagUndoToast(tag);
    } catch {
      setPendingRemoveTag(null);
      setFailedRemoveTag(tag);
    }
  };

  const requestRemoveTag = async (tag: NormalizedTag) => {
    if (isSaving) return;
    if (isProtectedTag(tag, tagPrefixes)) {
      setConfirmingRemoveTag(tag);
      return;
    }
    await removeTag(tag);
  };

  const confirmRemoveTag = async () => {
    const tag = confirmingRemoveTag;
    setConfirmingRemoveTag(null);
    if (tag) await removeTag(tag);
  };

  const cancelRemoveTag = () => setConfirmingRemoveTag(null);

  const undoRemoveTag = async () => {
    const tag = tagUndoToast;
    if (!tag || isSaving) return;
    addTagMutation.reset();
    removeTagMutation.reset();
    try {
      await addTagMutation.mutateAsync({ workId, tag });
      setTagUndoToast(null);
    } catch {
      /* トーストを残して再試行可能にする */
    }
  };

  const dismissTagUndoToast = () => setTagUndoToast(null);

  return {
    tags,
    suggestions: [...new Set(tagSuggestions)],
    isTagSaving: isSaving,
    patchTagsError: addTagMutation.error ?? removeTagMutation.error,
    pendingRemoveTag,
    failedRemoveTag,
    confirmingRemoveTag,
    tagUndoToast,
    addTag,
    requestRemoveTag,
    confirmRemoveTag,
    cancelRemoveTag,
    undoRemoveTag,
    dismissTagUndoToast,
    resetPatchTagsError: () => {
      addTagMutation.reset();
      removeTagMutation.reset();
    },
  };
}
