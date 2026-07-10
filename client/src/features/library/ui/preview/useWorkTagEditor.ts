import { useEffect, useMemo, useRef, useState } from "react";
import type { Work, WorkPatch } from "@mimimilli/shared";
import { parseTag } from "../../../../entities/work/model";
import { buildWorkPatchTags, getEditableFlatTags } from "../../../../entities/work/editableTags";

const TAG_UNDO_TOAST_MS = 6000;

export interface UseWorkTagEditorOptions {
  work: Work;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  /** タグ保存の成否をタイトル編集等と共有するエラー表示へ伝える。開始時は null で呼ぶ */
  onError: (message: string | null) => void;
}

export interface UseWorkTagEditorResult {
  structuredTags: string[];
  editableFlatTags: string[];
  flatTagSuggestions: string[];
  isTagSaving: boolean;
  pendingRemoveTag: string | null;
  failedRemoveTag: string | null;
  tagUndoToast: string | null;
  addFlatTag: (tag: string) => Promise<void>;
  removeFlatTag: (tag: string) => Promise<void>;
  undoRemoveTag: () => Promise<void>;
  dismissTagUndoToast: () => void;
}

/**
 * フラットタグの追加・削除と、削除の undo（トースト経由）をまとめて扱うフック。
 * undo は非同期の再保存トランザクションなので、pending/failed/トースト表示までここで完結させる。
 */
export function useWorkTagEditor({
  work,
  tagSuggestions,
  isPatching,
  onPatchWork,
  onError,
}: UseWorkTagEditorOptions): UseWorkTagEditorResult {
  const [isTagSaving, setIsTagSaving] = useState(false);
  const [pendingRemoveTag, setPendingRemoveTag] = useState<string | null>(null);
  const [failedRemoveTag, setFailedRemoveTag] = useState<string | null>(null);
  const [tagUndoToast, setTagUndoToast] = useState<string | null>(null);
  const tagUndoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    };
  }, []);

  const structuredTags = useMemo(
    () => work.tags.filter((tag) => parseTag(tag).kind !== "flat"),
    [work.tags],
  );
  const editableFlatTags = useMemo(() => getEditableFlatTags(work.tags), [work.tags]);
  const flatTagSuggestions = useMemo(
    () => [...new Set(tagSuggestions.filter((tag) => parseTag(tag).kind === "flat"))],
    [tagSuggestions],
  );

  const patchFlatTags = async (nextFlatTags: string[]): Promise<boolean> => {
    if (isPatching || isTagSaving) return false;
    const tags = buildWorkPatchTags(work.tags, nextFlatTags);
    setIsTagSaving(true);
    onError(null);
    try {
      await onPatchWork({ tags });
      return true;
    } catch {
      onError("タグを保存できませんでした。");
      return false;
    } finally {
      setIsTagSaving(false);
    }
  };

  const addFlatTag = async (tag: string) => {
    const nextTag = tag.trim();
    if (
      !nextTag ||
      parseTag(nextTag).kind !== "flat" ||
      editableFlatTags.some(
        (current) => current.toLocaleLowerCase() === nextTag.toLocaleLowerCase(),
      )
    ) {
      return;
    }

    await patchFlatTags([...editableFlatTags, nextTag]);
  };

  const showTagUndoToast = (tag: string) => {
    if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
    setTagUndoToast(tag);
    tagUndoTimerRef.current = setTimeout(() => setTagUndoToast(null), TAG_UNDO_TOAST_MS);
  };

  const removeFlatTag = async (tag: string) => {
    if (isPatching || isTagSaving) return;
    const nextFlatTags = editableFlatTags.filter((current) => current !== tag);
    setPendingRemoveTag(tag);
    setFailedRemoveTag(null);
    const ok = await patchFlatTags(nextFlatTags);
    setPendingRemoveTag(null);
    if (ok) {
      showTagUndoToast(tag);
    } else {
      setFailedRemoveTag(tag);
    }
  };

  const undoRemoveTag = async () => {
    const tag = tagUndoToast;
    if (!tag) return;
    // 別の保存が進行中の間は何もしない（トーストを消さず、undo要求を黙って捨てない）
    if (isPatching || isTagSaving) return;
    // 削除したタグだけを現在の集合へ戻す。undo待ちの間に行われた他のタグ編集は巻き戻さない。
    // 復元に失敗した場合はトーストを残して再試行可能にする（onError も呼ばれる）
    const restored = editableFlatTags.includes(tag) ? editableFlatTags : [...editableFlatTags, tag];
    const ok = await patchFlatTags(restored);
    if (ok) {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
      setTagUndoToast(null);
    }
  };

  const dismissTagUndoToast = () => setTagUndoToast(null);

  return {
    structuredTags,
    editableFlatTags,
    flatTagSuggestions,
    isTagSaving,
    pendingRemoveTag,
    failedRemoveTag,
    tagUndoToast,
    addFlatTag,
    removeFlatTag,
    undoRemoveTag,
    dismissTagUndoToast,
  };
}
