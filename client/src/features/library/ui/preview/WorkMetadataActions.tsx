import { useState } from "react";
import type { Track, Work, WorkPatch } from "@mimimilli/shared";
import { I } from "../../../../shared/ui/Icon";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { useAnchoredPopover } from "./useAnchoredPopover";

const ACTION_POPOVER_WIDTH = 240;

interface WorkMetadataActionsProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  hasResume: boolean;
  isPlayable: boolean;
  resumeTrack: Track | null;
  resumeTime: string;
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
  onError: (message: string | null) => void;
  onEdit: () => void;
  onShowInfo: () => void;
}

export function WorkMetadataActions({
  work,
  onPlay,
  onResume,
  hasResume,
  isPlayable,
  resumeTrack,
  resumeTime,
  isPatching,
  onPatchWork,
  onError,
  onEdit,
  onShowInfo,
}: WorkMetadataActionsProps) {
  const [isActionPopoverOpen, setIsActionPopoverOpen] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);

  const closeActionPopover = () => {
    setIsActionPopoverOpen(false);
  };
  const closeActionPopoverOnEscape = () => {
    closeActionPopover();
    onError(null);
  };

  const { anchorRef: actionPopoverRef, layout: actionPopoverLayout } = useAnchoredPopover({
    isOpen: isActionPopoverOpen,
    preferredWidth: ACTION_POPOVER_WIDTH,
    onOutsideClick: closeActionPopover,
    onEscape: closeActionPopoverOnEscape,
  });

  const toggleBookmark = async () => {
    if (isPatching) return;
    setIsBookmarkSaving(true);
    onError(null);
    try {
      await onPatchWork({ bookmarked: !work.bookmarked });
    } catch {
      onError("ブックマークを更新できませんでした。");
    } finally {
      setIsBookmarkSaving(false);
    }
  };

  return (
    <div className="mle-prv__actions">
      {hasResume && isPlayable ? (
        <>
          <Button
            variant="primary"
            icon={I.play}
            title={resumeTrack ? `${resumeTrack.title} · ${resumeTime} から再開` : undefined}
            onClick={onResume}
          >
            続きから {resumeTime}
          </Button>
          <IconButton icon={I.refresh} label="最初から再生" size="sm" onClick={() => onPlay(0)} />
        </>
      ) : (
        <Button
          variant="primary"
          icon={I.play}
          disabled={!isPlayable}
          aria-disabled={!isPlayable}
          onClick={() => {
            if (isPlayable) onPlay(0);
          }}
        >
          最初から再生
        </Button>
      )}
      <IconButton
        icon={I.heart}
        label={work.bookmarked ? "ブックマークを解除" : "ブックマークに追加"}
        size="sm"
        active={work.bookmarked}
        disabled={isBookmarkSaving || isPatching}
        className={work.bookmarked ? "[&_svg]:fill-current" : undefined}
        onClick={() => void toggleBookmark()}
      />
      <IconButton icon={I.edit} label="作品を編集" size="sm" onClick={onEdit} />
      <div ref={actionPopoverRef} className="relative inline-flex">
        <IconButton
          icon={I.more}
          label="その他"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={isActionPopoverOpen}
          active={isActionPopoverOpen}
          onClick={() => {
            onError(null);
            setIsActionPopoverOpen((open) => !open);
          }}
        />
        {isActionPopoverOpen && (
          <div
            className="absolute top-[calc(100%+6px)] z-10 rounded-[6px] border border-line-soft bg-paper-1 p-1 shadow-pop"
            style={{
              left: actionPopoverLayout.left,
              width: actionPopoverLayout.width,
            }}
          >
            <div className="flex flex-col gap-1" role="menu">
              <button
                type="button"
                role="menuitem"
                className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 font-jp text-[12px] text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2 focus:outline-none"
                onClick={() => {
                  closeActionPopover();
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
                      onClick={closeActionPopover}
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
    </div>
  );
}
