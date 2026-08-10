import { useEffect, useRef, useState } from "react";
import { parseTag, tagEquals } from "@mimimilli/shared";
import type { NormalizedTag, TagPrefix, Work } from "@mimimilli/shared";
import { buildTagsWithAdded, buildTagsWithRemoved } from "../../../../entities/work/editableTags";
import type { LibraryTagsPatchMutation } from "../../model/useLibraryQueries";

const TAG_UNDO_TOAST_MS = 6000;

export interface UseWorkTagEditorOptions {
  work: Work;
  tagSuggestions: string[];
  /** 保護判定（protected な prefix のタグは削除前に確認を挟む。ADR-0005） */
  tagPrefixes: TagPrefix[];
  tagsMutation: LibraryTagsPatchMutation;
}

export interface UseWorkTagEditorResult {
  tags: NormalizedTag[];
  suggestions: string[];
  isTagSaving: boolean;
  patchTagsError: LibraryTagsPatchMutation["error"];
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
 * 全タグが編集対象（ADR-0005）。undo は非同期の再保存トランザクションなので、
 * pending/failed/トースト表示までここで完結させる。
 */
export function useWorkTagEditor({
  work,
  tagSuggestions,
  tagPrefixes,
  tagsMutation,
}: UseWorkTagEditorOptions): UseWorkTagEditorResult {
  const [pendingRemoveTag, setPendingRemoveTag] = useState<NormalizedTag | null>(null);
  const [failedRemoveTag, setFailedRemoveTag] = useState<NormalizedTag | null>(null);
  const [confirmingRemoveTag, setConfirmingRemoveTag] = useState<NormalizedTag | null>(null);
  const [tagUndoToast, setTagUndoToast] = useState<NormalizedTag | null>(null);
  const tagUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    };
  }, []);

  const isProtectedTag = (tag: NormalizedTag): boolean => {
    const parsed = parseTag(tag);
    if (parsed.kind !== "annotated") return false;
    return tagPrefixes.some((p) => p.prefix === parsed.prefix && p.protected);
  };

  const patchTags = async (nextTags: NormalizedTag[]): Promise<boolean> => {
    if (tagsMutation.isPending) return false;
    tagsMutation.reset();
    try {
      await tagsMutation.mutateAsync({ workId: work.id, tags: nextTags });
      return true;
    } catch {
      return false;
    }
  };

  const addTag = async (tag: string) => {
    const nextTags = buildTagsWithAdded(work.tags, tag);
    if (!nextTags) return;
    await patchTags(nextTags);
  };

  const showTagUndoToast = (tag: NormalizedTag) => {
    if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    setTagUndoToast(tag);
    tagUndoTimerRef.current = setTimeout(() => setTagUndoToast(null), TAG_UNDO_TOAST_MS);
  };

  const removeTag = async (tag: NormalizedTag) => {
    if (tagsMutation.isPending) return;
    setPendingRemoveTag(tag);
    setFailedRemoveTag(null);
    const ok = await patchTags(buildTagsWithRemoved(work.tags, tag));
    setPendingRemoveTag(null);
    if (ok) {
      showTagUndoToast(tag);
    } else {
      setFailedRemoveTag(tag);
    }
  };

  const requestRemoveTag = async (tag: NormalizedTag) => {
    if (tagsMutation.isPending) return;
    if (isProtectedTag(tag)) {
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
    if (!tag) return;
    // 別の保存が進行中の間は何もしない（トーストを消さず、undo要求を黙って捨てない）
    if (tagsMutation.isPending) return;
    // 削除したタグだけを現在の集合へ戻す。undo待ちの間に行われた他のタグ編集は巻き戻さない。
    // 復元に失敗した場合はトーストを残して再試行可能にする
    const restored = work.tags.some((current) => tagEquals(current, tag))
      ? work.tags
      : [...work.tags, tag];
    const ok = await patchTags(restored);
    if (ok) {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
      setTagUndoToast(null);
    }
  };

  const dismissTagUndoToast = () => setTagUndoToast(null);

  return {
    tags: work.tags,
    suggestions: [...new Set(tagSuggestions)],
    isTagSaving: tagsMutation.isPending,
    patchTagsError: tagsMutation.error,
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
    resetPatchTagsError: tagsMutation.reset,
  };
}
