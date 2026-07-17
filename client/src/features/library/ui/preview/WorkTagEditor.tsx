import { useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { normalizeTag, parseTag } from "@mimimilli/shared";
import type { Work, WorkPatch } from "@mimimilli/shared";
import { sortTagsForDisplay } from "../../../../entities/work/sortTagsForDisplay";
import Tag from "../../../../entities/work/ui/Tag";
import { I } from "../../../../shared/ui/Icon";
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import IconButton from "../../../../shared/ui/IconButton";
import TagCombobox from "../../../../shared/ui/TagCombobox";
import Toast from "../../../../shared/ui/Toast";
import { tagPrefixesAtom } from "../../model/atoms";
import { useAnchoredPopover } from "./useAnchoredPopover";
import { useWorkTagEditor } from "./useWorkTagEditor";

const TAG_POPOVER_WIDTH = 260;
// 詳細ペインをタグで圧迫せず、優先度の高い分類を一目で確認できる表示上限。
const COLLAPSED_TAG_LIMIT = 8;
// 右ペインの実幅がこれを下回る場合、タグ追加UIは浮遊ポップオーバーではなく
// チップ列下のフル幅行として展開する（狭幅で右方向に展開する余地がないため）。
const NARROW_TAG_PANE_PX = 320;

interface WorkTagEditorProps {
  work: Work;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  onError: (message: string | null) => void;
}

export function WorkTagEditor({
  work,
  tagSuggestions,
  isPatching,
  onPatchWork,
  onError,
}: WorkTagEditorProps) {
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [areAllTagsVisible, setAreAllTagsVisible] = useState(false);
  const tagEditorRef = useRef<HTMLDivElement | null>(null);
  const tagPrefixes = useAtomValue(tagPrefixesAtom);

  const {
    tags,
    suggestions,
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
  } = useWorkTagEditor({ work, tagSuggestions, tagPrefixes, isPatching, onPatchWork, onError });

  const closeTagPopover = () => setIsTagPopoverOpen(false);
  const { anchorRef: tagPopoverAnchorRef, layout: tagPopoverLayout } = useAnchoredPopover({
    isOpen: isTagPopoverOpen,
    preferredWidth: TAG_POPOVER_WIDTH,
    onOutsideClick: closeTagPopover,
    onEscape: closeTagPopover,
    boundaryRef: tagEditorRef,
  });
  const isNarrowTagPane = tagPopoverLayout.containerWidth < NARROW_TAG_PANE_PX;
  const sortedTags = sortTagsForDisplay(tags, tagPrefixes);
  const hiddenTagCount = Math.max(0, sortedTags.length - COLLAPSED_TAG_LIMIT);
  const visibleTags = areAllTagsVisible ? sortedTags : sortedTags.slice(0, COLLAPSED_TAG_LIMIT);

  const selectTag = (tag: string) => {
    closeTagPopover();
    void addTag(tag);
  };

  const definitionOf = (tag: string) => {
    const parsed = parseTag(tag);
    if (parsed.kind !== "annotated") return null;
    return tagPrefixes.find((p) => p.prefix === parsed.prefix) ?? null;
  };

  const comboboxProps = {
    suggestions,
    excludeTags: tags,
    disabled: isTagSaving || isPatching,
    canCreate: (tag: string) => normalizeTag(tag).length > 0,
    onSelect: selectTag,
    onCancel: closeTagPopover,
  };

  return (
    <>
      <div className="mle-prv__tag-row">
        <div className="mle-prv__tags w-full">
          {visibleTags.map((tag) => {
            const isPending = pendingRemoveTag === tag;
            const isFailed = failedRemoveTag === tag;
            const isBlocked = isPatching || (isTagSaving && !isPending);
            return (
              <Tag
                key={tag}
                tag={tag}
                definition={definitionOf(tag)}
                pending={isPending}
                failed={isFailed}
                onRemove={isBlocked ? undefined : () => void requestRemoveTag(tag)}
              />
            );
          })}
          {hiddenTagCount > 0 && !areAllTagsVisible && (
            <Tag
              tag={`+${hiddenTagCount}`}
              ariaLabel={`残り${hiddenTagCount}個のタグを表示`}
              onClick={() => setAreAllTagsVisible(true)}
            />
          )}
          <div ref={tagEditorRef} className="contents">
            <div ref={tagPopoverAnchorRef} className="relative inline-flex">
              <IconButton
                icon={I.add}
                label="タグを追加"
                size="sm"
                className="h-5 w-5 rounded-1 bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink-0"
                disabled={isTagSaving || isPatching}
                onClick={() => {
                  onError(null);
                  setIsTagPopoverOpen((open) => !open);
                }}
              />
              {isTagPopoverOpen && !isNarrowTagPane && (
                <div
                  className="absolute top-[calc(100%+6px)] z-10 rounded-[6px] bg-paper-1 shadow-pop"
                  style={{
                    left: tagPopoverLayout.left,
                    width: tagPopoverLayout.width,
                  }}
                >
                  <TagCombobox focusOnMount width={tagPopoverLayout.width} {...comboboxProps} />
                </div>
              )}
            </div>
            {isTagPopoverOpen &&
              isNarrowTagPane && (
                // 右ペインが狭く浮遊ポップオーバーを展開する余地がないため、
                // チップ列の下にフル幅の行として展開する（flex-wrap の basis-full で改行させる）。
                <div className="mt-1 basis-full rounded-[6px] bg-paper-1 shadow-pop">
                  <TagCombobox focusOnMount width="full" {...comboboxProps} />
                </div>
              )}
          </div>
        </div>
      </div>
      {confirmingRemoveTag && (
        <ConfirmDialog
          title="保護タグの削除"
          message={`「${confirmingRemoveTag}」は保護された分類のタグです。削除しますか？`}
          confirmLabel="削除する"
          onConfirm={() => void confirmRemoveTag()}
          onCancel={cancelRemoveTag}
        />
      )}
      <Toast
        message={tagUndoToast ? `タグ「${tagUndoToast}」を削除しました` : null}
        actionLabel="元に戻す"
        onAction={() => void undoRemoveTag()}
        onDismiss={dismissTagUndoToast}
      />
    </>
  );
}
