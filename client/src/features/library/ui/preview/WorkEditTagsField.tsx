import { useEffect } from "react";
import type { NormalizedTag, TagPrefix } from "@mimimilli/shared";
import { sortTagsForDisplay } from "../../../../entities/work/sortTagsForDisplay";
import { tagPrefixDefinition } from "../../../../entities/tag/tagPrefixDefinition";
import Tag from "../../../../entities/work/ui/Tag";
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import { useToast } from "../../../../shared/ui/useToast";
import { TagAddPopover } from "./TagAddPopover";

interface WorkEditTagsFieldProps {
  tags: NormalizedTag[];
  tagSuggestions: string[];
  tagPrefixes: TagPrefix[];
  disabled?: boolean;
  onAddTag: (raw: string) => void;
  onRequestRemoveTag: (tag: NormalizedTag) => void;
  confirmingRemoveTag: NormalizedTag | null;
  onConfirmRemoveTag: () => void;
  onCancelRemoveTag: () => void;
  /** 保存を押した時点で親（WorkEditDialog）が無効化する。未提示ならundoトーストを出さない。 */
  undoableTag: NormalizedTag | null;
  onUndoRemoveTag: () => void;
  onDismissUndo: () => void;
}

/** 作品編集ダイアログのタグdraft編集UI（ADR-0025）。追加・削除ともにローカルの配列
 *  操作で、サーバー通信は保存ボタンを押すまで発生しない。draft状態そのもの
 *  （confirmingRemoveTag・undoableTag）は親（WorkEditDialog）が保持し、保存開始時に
 *  undo導線を無効化できるようにする。 */
export function WorkEditTagsField({
  tags,
  tagSuggestions,
  tagPrefixes,
  disabled = false,
  onAddTag,
  onRequestRemoveTag,
  confirmingRemoveTag,
  onConfirmRemoveTag,
  onCancelRemoveTag,
  undoableTag,
  onUndoRemoveTag,
  onDismissUndo,
}: WorkEditTagsFieldProps) {
  const { show: showToast, dismiss: dismissToast } = useToast();
  useEffect(() => {
    if (!undoableTag) {
      dismissToast();
      return;
    }
    showToast({
      message: `タグ「${undoableTag}」を削除しました`,
      variant: "success",
      actionLabel: "元に戻す",
      onAction: onUndoRemoveTag,
      priority: "action",
      onDismiss: onDismissUndo,
    });
  }, [undoableTag, onUndoRemoveTag, onDismissUndo, showToast, dismissToast]);

  const sortedTags = sortTagsForDisplay(tags, tagPrefixes);

  return (
    <>
      <div className="mle-prv__tag-row">
        <div className="mle-prv__tags w-full">
          {sortedTags.map((tag) => (
            <Tag
              key={tag}
              tag={tag}
              definition={tagPrefixDefinition(tag, tagPrefixes)}
              onRemove={disabled ? undefined : () => onRequestRemoveTag(tag)}
            />
          ))}
          <TagAddPopover
            suggestions={tagSuggestions}
            excludeTags={tags}
            disabled={disabled}
            onSelect={onAddTag}
          />
        </div>
      </div>
      {confirmingRemoveTag && (
        <ConfirmDialog
          title="保護タグの削除"
          message={`「${confirmingRemoveTag}」は保護されたタグです。削除しますか？`}
          confirmLabel="削除する"
          onConfirm={onConfirmRemoveTag}
          onCancel={onCancelRemoveTag}
        />
      )}
    </>
  );
}
