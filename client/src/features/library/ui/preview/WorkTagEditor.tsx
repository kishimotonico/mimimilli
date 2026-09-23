import { useEffect, useRef, useState } from "react";
import { normalizeTag } from "@mimimilli/shared";
import type { NormalizedTag, Work } from "@mimimilli/shared";
import { sortTagsForDisplay } from "../../../../entities/work/sortTagsForDisplay";
import Tag from "../../../../entities/work/ui/Tag";
import { I } from "../../../../shared/ui/Icon";
import ConfirmDialog from "../../../../shared/ui/ConfirmDialog";
import IconButton from "../../../../shared/ui/IconButton";
import TagCombobox from "../../../../shared/ui/TagCombobox";
import { useToast } from "../../../../shared/ui/useToast";
import {
  sourceMutationErrorMessage,
  projectionWorkspacePath,
} from "../../../../entities/work/sourceMutation";
import { SourceProjectionNotice } from "../../../../entities/work/ui/SourceProjectionNotice";
import { useRootFolderOrNull } from "../../../../entities/settings/useSettingsQuery";
import type { LibraryTagIntentMutation } from "../../model/useLibraryQueries";
import { useTagPrefixes } from "../../../../entities/tag/useTagPrefixes";
import { tagPrefixDefinition } from "../../../../entities/tag/tagPrefixDefinition";
import { useAnchoredPopover } from "../../../../shared/ui/useAnchoredPopover";
import { useWorkTagEditor } from "./useWorkTagEditor";
import {
  sourceCommandBlockMessage,
  WorkSourcePatchBlockedNotice,
} from "./WorkSourcePatchBlockedNotice";

const TAG_POPOVER_WIDTH = 260;
// 詳細ペインをタグで圧迫せず、優先度の高い分類を一目で確認できる表示上限。
const COLLAPSED_TAG_LIMIT = 8;
// 右ペインの実幅がこれを下回る場合、タグ追加UIは浮遊ポップオーバーではなく
// チップ列下のフル幅行として展開する（狭幅で右方向に展開する余地がないため）。
const NARROW_TAG_PANE_PX = 320;

interface WorkTagEditorProps {
  work: Work;
  tagSuggestions: string[];
  addTagMutation: LibraryTagIntentMutation;
  removeTagMutation: LibraryTagIntentMutation;
  /** 編集ダイアログなど、折りたたむ必要がない場所では全タグを表示する。
   *  この場合は編集ダイアログ自体が明示的な編集操作なので削除ボタンは常時表示のまま。 */
  expanded?: boolean;
  /** タグチップクリック時のハンドラ（絞り込み遷移。ADR-0013）。expanded=true の
   *  編集ダイアログ内では使わない（そこはタグクリックで遷移させない） */
  onTagClick?: (tag: NormalizedTag, opts: { ctrlKey: boolean; metaKey: boolean }) => void;
}

export function WorkTagEditor({
  work,
  tagSuggestions,
  addTagMutation,
  removeTagMutation,
  expanded = false,
  onTagClick,
}: WorkTagEditorProps) {
  const rootFolder = useRootFolderOrNull();
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [areAllTagsVisible, setAreAllTagsVisible] = useState(false);
  // 削除✕ボタンは誤操作防止のため既定で非表示（追加の2段階フローと対称にする）。
  // expanded（編集ダイアログ）はそれ自体が明示的な編集操作のため常に編集中扱い
  const [isEditMode, setIsEditMode] = useState(false);
  const showRemoveButtons = expanded || isEditMode;
  const tagEditorRef = useRef<HTMLDivElement | null>(null);
  const { tagPrefixes } = useTagPrefixes();

  const {
    tags,
    suggestions,
    isTagSaving,
    patchTagsError,
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
    resetPatchTagsError,
  } = useWorkTagEditor({
    workId: work.id,
    tags: work.tags,
    tagSuggestions,
    tagPrefixes,
    addTagMutation,
    removeTagMutation,
  });

  const [blockedMessage, setBlockedMessage] = useState<string | null>(() =>
    sourceCommandBlockMessage(patchTagsError),
  );
  const [blockEpoch, setBlockEpoch] = useState({
    id: work.id,
    title: work.title,
    tags: work.tags,
    urls: work.urls,
  });
  if (
    blockEpoch.id !== work.id ||
    blockEpoch.title !== work.title ||
    blockEpoch.tags !== work.tags ||
    blockEpoch.urls !== work.urls
  ) {
    setBlockEpoch({ id: work.id, title: work.title, tags: work.tags, urls: work.urls });
    setBlockedMessage(null);
  }

  useEffect(() => {
    const message = sourceCommandBlockMessage(patchTagsError);
    if (message) setBlockedMessage(message);
  }, [patchTagsError]);

  const canEditTags = blockedMessage === null;

  const closeTagPopover = () => setIsTagPopoverOpen(false);
  const {
    setReference: setTagPopoverAnchorRef,
    setFloating: setTagPopoverFloating,
    floatingStyles: tagPopoverStyles,
    containerWidth: tagPopoverContainerWidth,
    close,
  } = useAnchoredPopover({
    isOpen: isTagPopoverOpen,
    preferredWidth: TAG_POPOVER_WIDTH,
    onClose: () => closeTagPopover(),
    boundaryRef: tagEditorRef,
  });
  const isNarrowTagPane = tagPopoverContainerWidth < NARROW_TAG_PANE_PX;
  const sortedTags = sortTagsForDisplay(tags, tagPrefixes);
  const hiddenTagCount = Math.max(0, sortedTags.length - COLLAPSED_TAG_LIMIT);
  const visibleTags =
    expanded || areAllTagsVisible ? sortedTags : sortedTags.slice(0, COLLAPSED_TAG_LIMIT);

  const selectTag = (tag: string) => {
    close();
    if (!canEditTags) return;
    void addTag(tag);
  };

  const definitionOf = (tag: string) => tagPrefixDefinition(tag, tagPrefixes);

  const comboboxProps = {
    suggestions,
    excludeTags: tags,
    disabled: isTagSaving || !canEditTags,
    canCreate: (tag: string) => normalizeTag(tag) !== null,
    onSelect: selectTag,
    onCancel: close,
  };

  const patchTagsErrorMessage =
    sourceCommandBlockMessage(patchTagsError) === null && patchTagsError
      ? sourceMutationErrorMessage(patchTagsError, "タグを保存できませんでした。")
      : null;

  const { show: showToast, dismiss: dismissToast } = useToast();
  useEffect(() => {
    if (patchTagsErrorMessage) {
      showToast({
        message: patchTagsErrorMessage,
        variant: "error",
        priority: "action",
        onDismiss: resetPatchTagsError,
      });
    } else if (tagUndoToast) {
      showToast({
        message: `タグ「${tagUndoToast}」を削除しました`,
        variant: "success",
        actionLabel: "元に戻す",
        onAction: () => void undoRemoveTag(),
        priority: "action",
        onDismiss: dismissTagUndoToast,
      });
    } else {
      dismissToast();
    }
  }, [
    patchTagsErrorMessage,
    tagUndoToast,
    undoRemoveTag,
    dismissTagUndoToast,
    resetPatchTagsError,
    showToast,
    dismissToast,
  ]);

  useEffect(() => {
    if (!canEditTags) setIsTagPopoverOpen(false);
  }, [canEditTags]);

  return (
    <>
      <div className="mle-prv__tag-row">
        <div className="mle-prv__tags w-full">
          {visibleTags.map((tag) => {
            const isPending = pendingRemoveTag === tag;
            const isFailed = failedRemoveTag === tag;
            const isBlocked = isTagSaving && !isPending;
            const canRemove = showRemoveButtons && !isBlocked && canEditTags;
            return (
              <Tag
                key={tag}
                tag={tag}
                definition={definitionOf(tag)}
                pending={isPending}
                failed={isFailed}
                onRemove={canRemove ? () => void requestRemoveTag(tag) : undefined}
                onClick={
                  !showRemoveButtons && onTagClick ? (opts) => onTagClick(tag, opts) : undefined
                }
                ariaLabel={
                  !showRemoveButtons && onTagClick ? `タグ「${tag}」で絞り込む` : undefined
                }
              />
            );
          })}
          {hiddenTagCount > 0 && !expanded && !areAllTagsVisible && (
            <Tag
              tag={`+${hiddenTagCount}`}
              ariaLabel={`残り${hiddenTagCount}個のタグを表示`}
              onClick={() => setAreAllTagsVisible(true)}
            />
          )}
          <div ref={tagEditorRef} className="contents">
            {!expanded && (
              <IconButton
                icon={I.edit}
                label={isEditMode ? "タグ編集を終了" : "タグを編集"}
                size="xs"
                active={isEditMode}
                disabled={!canEditTags}
                onClick={() => setIsEditMode((v) => !v)}
              />
            )}
            <div ref={setTagPopoverAnchorRef} className="relative inline-flex">
              <IconButton
                icon={I.add}
                label="タグを追加"
                size="xs"
                className="bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink-0"
                disabled={isTagSaving || !canEditTags}
                onClick={() => {
                  resetPatchTagsError();
                  if (isTagPopoverOpen) close();
                  else setIsTagPopoverOpen(true);
                }}
              />
              {isTagPopoverOpen && !isNarrowTagPane && (
                <div
                  ref={setTagPopoverFloating}
                  className="absolute z-10 rounded-[6px] bg-paper-1 shadow-pop"
                  style={tagPopoverStyles}
                >
                  <TagCombobox
                    focusOnMount
                    width={
                      typeof tagPopoverStyles.width === "number"
                        ? tagPopoverStyles.width
                        : TAG_POPOVER_WIDTH
                    }
                    {...comboboxProps}
                  />
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
      <WorkSourcePatchBlockedNotice message={blockedMessage} />
      <SourceProjectionNotice
        projection={
          (addTagMutation.submittedAt >= removeTagMutation.submittedAt
            ? addTagMutation.data
            : removeTagMutation.data
          )?.projection
        }
        path={
          rootFolder
            ? projectionWorkspacePath({ physicalPath: work.physicalPath }, rootFolder)
            : null
        }
      />
      {confirmingRemoveTag && (
        <ConfirmDialog
          title="保護タグの削除"
          message={`「${confirmingRemoveTag}」は保護された分類のタグです。削除しますか？`}
          confirmLabel="削除する"
          onConfirm={() => void confirmRemoveTag()}
          onCancel={cancelRemoveTag}
        />
      )}
    </>
  );
}
