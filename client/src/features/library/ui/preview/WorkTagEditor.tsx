import { useRef, useState } from "react";
import type { Work, WorkPatch } from "@mimimilli/shared";
import Tag from "../../../../entities/work/ui/Tag";
import { parseTag } from "../../../../entities/work/model";
import { I } from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import TagCombobox from "../../../../shared/ui/TagCombobox";
import Toast from "../../../../shared/ui/Toast";
import { useAnchoredPopover } from "./useAnchoredPopover";
import { useWorkTagEditor } from "./useWorkTagEditor";

const TAG_POPOVER_WIDTH = 260;
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
  const tagEditorRef = useRef<HTMLDivElement | null>(null);

  const {
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
  } = useWorkTagEditor({ work, tagSuggestions, isPatching, onPatchWork, onError });

  const closeTagPopover = () => setIsTagPopoverOpen(false);
  const { anchorRef: tagPopoverAnchorRef, layout: tagPopoverLayout } = useAnchoredPopover({
    isOpen: isTagPopoverOpen,
    preferredWidth: TAG_POPOVER_WIDTH,
    onOutsideClick: closeTagPopover,
    onEscape: closeTagPopover,
    boundaryRef: tagEditorRef,
  });
  const isNarrowTagPane = tagPopoverLayout.containerWidth < NARROW_TAG_PANE_PX;

  const selectTag = (tag: string) => {
    closeTagPopover();
    void addFlatTag(tag);
  };

  return (
    <>
      <div className="mle-prv__tag-row">
        <div className="mle-prv__tags w-full">
          {structuredTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex"
              title="分類タグはメタデータ保護のため編集対象外です"
            >
              <Tag tag={tag} />
            </span>
          ))}
          {editableFlatTags.map((tag) => {
            const isPending = pendingRemoveTag === tag;
            const isFailed = failedRemoveTag === tag;
            const isBlocked = isPatching || (isTagSaving && !isPending);
            return (
              <Tag
                key={tag}
                tag={tag}
                pending={isPending}
                failed={isFailed}
                onRemove={isBlocked ? undefined : () => void removeFlatTag(tag)}
              />
            );
          })}
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
                  <TagCombobox
                    focusOnMount
                    width={tagPopoverLayout.width}
                    suggestions={flatTagSuggestions}
                    excludeTags={editableFlatTags}
                    disabled={isTagSaving || isPatching}
                    canCreate={(tag) => parseTag(tag).kind === "flat"}
                    onSelect={selectTag}
                    onCancel={closeTagPopover}
                  />
                </div>
              )}
            </div>
            {isTagPopoverOpen &&
              isNarrowTagPane && (
                // 右ペインが狭く浮遊ポップオーバーを展開する余地がないため、
                // チップ列の下にフル幅の行として展開する（flex-wrap の basis-full で改行させる）。
                <div className="mt-1 basis-full rounded-[6px] bg-paper-1 shadow-pop">
                  <TagCombobox
                    focusOnMount
                    width="full"
                    suggestions={flatTagSuggestions}
                    excludeTags={editableFlatTags}
                    disabled={isTagSaving || isPatching}
                    canCreate={(tag) => parseTag(tag).kind === "flat"}
                    onSelect={selectTag}
                    onCancel={closeTagPopover}
                  />
                </div>
              )}
          </div>
        </div>
      </div>
      <Toast
        message={tagUndoToast ? `タグ「${tagUndoToast}」を削除しました` : null}
        actionLabel="元に戻す"
        onAction={() => void undoRemoveTag()}
        onDismiss={dismissTagUndoToast}
      />
    </>
  );
}
