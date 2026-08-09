import { useState } from "react";
import type { Work } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import IconButton from "../../../../shared/ui/IconButton";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import type { LibraryBookmarkPatchMutation } from "../../model/useLibraryQueries";
import {
  useAnchoredPopover,
  type PopoverContainerResolver,
} from "../../../../shared/ui/useAnchoredPopover";

const ACTION_POPOVER_WIDTH = 240;

const actionPopoverContainerResolver: PopoverContainerResolver = (anchor) =>
  anchor.closest(".mle-prv__body");

interface WorkMetadataActionsProps {
  work: Work;
  bookmarkMutation: LibraryBookmarkPatchMutation;
  onEdit: () => void;
  onShowInfo: () => void;
}

export function WorkMetadataActions({
  work,
  bookmarkMutation,
  onEdit,
  onShowInfo,
}: WorkMetadataActionsProps) {
  const [isActionPopoverOpen, setIsActionPopoverOpen] = useState(false);

  const closeActionPopover = () => setIsActionPopoverOpen(false);

  const {
    setReference: setActionPopoverRef,
    setFloating: setActionPopoverFloating,
    floatingStyles: actionPopoverStyles,
    close,
  } = useAnchoredPopover({
    isOpen: isActionPopoverOpen,
    preferredWidth: ACTION_POPOVER_WIDTH,
    getContainer: actionPopoverContainerResolver,
    onClose: (reason) => {
      closeActionPopover();
      if (reason === "escape") bookmarkMutation.reset();
    },
  });

  const toggleBookmark = () => {
    if (bookmarkMutation.isPending) return;
    bookmarkMutation.reset();
    bookmarkMutation.mutate({ workId: work.id, bookmarked: !work.bookmarked });
  };

  const bookmarkError = bookmarkMutation.error
    ? apiErrorMessage(bookmarkMutation.error, "ブックマークを更新できませんでした。")
    : null;

  return (
    <div className="mle-prv__actions">
      <IconButton
        icon={I.heart}
        label={work.bookmarked ? "ブックマークを解除" : "ブックマークに追加"}
        size="sm"
        active={work.bookmarked}
        disabled={bookmarkMutation.isPending}
        className={work.bookmarked ? "[&_svg]:fill-current" : undefined}
        onClick={toggleBookmark}
      />
      <IconButton icon={I.edit} label="作品を編集" size="sm" onClick={onEdit} />
      <div ref={setActionPopoverRef} className="relative inline-flex">
        <IconButton
          icon={I.more}
          label="その他"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={isActionPopoverOpen}
          active={isActionPopoverOpen}
          onClick={() => {
            bookmarkMutation.reset();
            if (isActionPopoverOpen) close();
            else setIsActionPopoverOpen(true);
          }}
        />
        {isActionPopoverOpen && (
          <div
            ref={setActionPopoverFloating}
            className="absolute z-10 rounded-[6px] border border-line-soft bg-paper-1 p-1 shadow-pop"
            style={actionPopoverStyles}
          >
            <div className="flex flex-col gap-1" role="menu">
              <button
                type="button"
                role="menuitem"
                className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 font-jp text-[12px] text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2 focus:outline-none"
                onClick={() => {
                  close();
                  onShowInfo();
                }}
              >
                <I.info size={13} />
                <span className="min-w-0 flex-1 truncate">作品の情報</span>
              </button>
              {work.urls.length > 0 && (
                <>
                  <hr className="my-1 border-0 border-t border-t-line-soft" />
                  {work.urls.map((u) => (
                    <a
                      key={u.url}
                      role="menuitem"
                      className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 font-jp text-[12px] text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2 focus:outline-none"
                      href={u.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => close()}
                    >
                      <I.ext size={13} />
                      <span className="min-w-0 flex-1 truncate">
                        {u.label === "DLsite" ? "DLsiteを開く" : `${u.label}を開く`}
                      </span>
                    </a>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      {bookmarkError && (
        <p className="mle-prv__edit-error" role="alert">
          {bookmarkError}
        </p>
      )}
    </div>
  );
}
