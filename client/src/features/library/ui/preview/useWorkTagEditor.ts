import { useEffect, useRef, useState } from "react";
import { parseTag, tagEquals } from "@mimimilli/shared";
import type { TagPrefix, Work, WorkPatch } from "@mimimilli/shared";
import { buildTagsWithAdded, buildTagsWithRemoved } from "../../../../entities/work/editableTags";

const TAG_UNDO_TOAST_MS = 6000;

export interface UseWorkTagEditorOptions {
  work: Work;
  tagSuggestions: string[];
  /** 保護判定（protected な prefix のタグは削除前に確認を挟む。ADR-0005） */
  tagPrefixes: TagPrefix[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  /** タグ保存の成否をタイトル編集等と共有するエラー表示へ伝える。開始時は null で呼ぶ */
  onError: (message: string | null) => void;
}

export interface UseWorkTagEditorResult {
  tags: string[];
  suggestions: string[];
  isTagSaving: boolean;
  pendingRemoveTag: string | null;
  failedRemoveTag: string | null;
  /** 保護タグの削除確認待ち。ConfirmDialog の表示トリガー */
  confirmingRemoveTag: string | null;
  tagUndoToast: string | null;
  addTag: (tag: string) => Promise<void>;
  /** 削除要求。保護タグなら確認待ちにし、それ以外は即削除する */
  requestRemoveTag: (tag: string) => Promise<void>;
  confirmRemoveTag: () => Promise<void>;
  cancelRemoveTag: () => void;
  undoRemoveTag: () => Promise<void>;
  dismissTagUndoToast: () => void;
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
  isPatching,
  onPatchWork,
  onError,
}: UseWorkTagEditorOptions): UseWorkTagEditorResult {
  const [isTagSaving, setIsTagSaving] = useState(false);
  const [pendingRemoveTag, setPendingRemoveTag] = useState<string | null>(null);
  const [failedRemoveTag, setFailedRemoveTag] = useState<string | null>(null);
  const [confirmingRemoveTag, setConfirmingRemoveTag] = useState<string | null>(null);
  const [tagUndoToast, setTagUndoToast] = useState<string | null>(null);
  const tagUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    };
  }, []);

  const isProtectedTag = (tag: string): boolean => {
    const parsed = parseTag(tag);
    if (parsed.kind !== "annotated") return false;
    return tagPrefixes.some((p) => p.prefix === parsed.prefix && p.protected);
  };

  const patchTags = async (nextTags: string[]): Promise<boolean> => {
    if (isPatching || isTagSaving) return false;
    setIsTagSaving(true);
    onError(null);
    try {
      await onPatchWork({ tags: nextTags });
      return true;
    } catch {
      onError("タグを保存できませんでした。");
      return false;
    } finally {
      setIsTagSaving(false);
    }
  };

  const addTag = async (tag: string) => {
    const nextTags = buildTagsWithAdded(work.tags, tag);
    if (!nextTags) return;
    await patchTags(nextTags);
  };

  const showTagUndoToast = (tag: string) => {
    if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    setTagUndoToast(tag);
    tagUndoTimerRef.current = setTimeout(() => setTagUndoToast(null), TAG_UNDO_TOAST_MS);
  };

  const removeTag = async (tag: string) => {
    if (isPatching || isTagSaving) return;
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

  const requestRemoveTag = async (tag: string) => {
    if (isPatching || isTagSaving) return;
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
    if (isPatching || isTagSaving) return;
    // 削除したタグだけを現在の集合へ戻す。undo待ちの間に行われた他のタグ編集は巻き戻さない。
    // 復元に失敗した場合はトーストを残して再試行可能にする（onError も呼ばれる）
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
    isTagSaving,
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
  };
}
