import { useState } from "react";
import { normalizeTag, tagEquals } from "@mimimilli/shared";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { isProtectedTag } from "../../../../entities/tag/isProtectedTag";

export interface UseWorkEditTagsDraftOptions {
  tags: NormalizedTag[];
  onChange: (tags: NormalizedTag[]) => void;
  tagPrefixes: TagPrefix[];
}

export interface UseWorkEditTagsDraftResult {
  addTag: (raw: string) => void;
  requestRemoveTag: (tag: NormalizedTag) => void;
  confirmingRemoveTag: NormalizedTag | null;
  confirmRemoveTag: () => void;
  cancelRemoveTag: () => void;
  undoableTag: NormalizedTag | null;
  undoRemoveTag: () => void;
  dismissUndo: () => void;
}

/**
 * 作品編集ダイアログ内のタグdraft操作（ADR-0025 一括draft保存）。サーバー通信はせず、
 * 保存時に title・urls と一緒に1回のPATCHへ含める。詳細ペイン常駐の意図コマンド版
 * （useWorkTagEditor.ts）とは別系統。保護タグの削除は確認を挟み、undoは保存前draftへの
 * 取り消し（再送信しない。保存を押した時点で無効化するのは呼び出し側の責務）。
 */
export function useWorkEditTagsDraft({
  tags,
  onChange,
  tagPrefixes,
}: UseWorkEditTagsDraftOptions): UseWorkEditTagsDraftResult {
  const [confirmingRemoveTag, setConfirmingRemoveTag] = useState<NormalizedTag | null>(null);
  const [undoableTag, setUndoableTag] = useState<NormalizedTag | null>(null);

  const addTag = (raw: string) => {
    const normalized = normalizeTag(raw);
    if (!normalized) return;
    if (tags.some((existing) => tagEquals(existing, normalized))) return;
    onChange([...tags, normalized]);
  };

  const removeTag = (tag: NormalizedTag) => {
    onChange(tags.filter((existing) => !tagEquals(existing, tag)));
    setUndoableTag(tag);
  };

  const requestRemoveTag = (tag: NormalizedTag) => {
    if (isProtectedTag(tag, tagPrefixes)) {
      setConfirmingRemoveTag(tag);
      return;
    }
    removeTag(tag);
  };

  const confirmRemoveTag = () => {
    const tag = confirmingRemoveTag;
    setConfirmingRemoveTag(null);
    if (tag) removeTag(tag);
  };

  const cancelRemoveTag = () => setConfirmingRemoveTag(null);

  const undoRemoveTag = () => {
    if (!undoableTag) return;
    if (!tags.some((existing) => tagEquals(existing, undoableTag))) {
      onChange([...tags, undoableTag]);
    }
    setUndoableTag(null);
  };

  const dismissUndo = () => setUndoableTag(null);

  return {
    addTag,
    requestRemoveTag,
    confirmingRemoveTag,
    confirmRemoveTag,
    cancelRemoveTag,
    undoableTag,
    undoRemoveTag,
    dismissUndo,
  };
}
