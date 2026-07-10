import { useEffect, useRef, useState } from "react";
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
}: WorkMetadataActionsProps) {
  const [actionPopoverMode, setActionPopoverMode] = useState<"menu" | "title" | null>(null);
  const [titleDraft, setTitleDraft] = useState(work.title);
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  const closeActionPopover = () => {
    setActionPopoverMode(null);
    setTitleDraft(work.title);
  };
  const closeActionPopoverOnEscape = () => {
    closeActionPopover();
    onError(null);
  };

  const { anchorRef: actionPopoverRef, layout: actionPopoverLayout } = useAnchoredPopover({
    isOpen: actionPopoverMode !== null,
    preferredWidth: ACTION_POPOVER_WIDTH,
    onOutsideClick: closeActionPopover,
    onEscape: closeActionPopoverOnEscape,
  });

  useEffect(() => {
    if (actionPopoverMode !== "title") return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [actionPopoverMode]);

  const startTitleEditing = () => {
    setTitleDraft(work.title);
    onError(null);
    setActionPopoverMode("title");
  };

  const cancelTitleEditing = () => {
    setTitleDraft(work.title);
    onError(null);
    setActionPopoverMode(null);
  };

  const saveTitle = async () => {
    const title = titleDraft.trim();
    if (!title || isPatching) return;
    if (title === work.title) {
      setActionPopoverMode(null);
      return;
    }

    setIsTitleSaving(true);
    onError(null);
    try {
      await onPatchWork({ title });
      setActionPopoverMode(null);
    } catch {
      onError("タイトルを保存できませんでした。");
    } finally {
      setIsTitleSaving(false);
    }
  };

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
      <div ref={actionPopoverRef} className="relative inline-flex">
        <IconButton
          icon={I.more}
          label="その他"
          size="sm"
          aria-haspopup="menu"
          aria-expanded={actionPopoverMode !== null}
          active={actionPopoverMode !== null}
          onClick={() => {
            onError(null);
            setActionPopoverMode((mode) => (mode === "menu" ? null : "menu"));
          }}
        />
        {actionPopoverMode && (
          <div
            className="absolute top-[calc(100%+6px)] z-10 rounded-[6px] border border-line-soft bg-paper-1 p-1 shadow-pop"
            style={{
              left: actionPopoverLayout.left,
              width: actionPopoverLayout.width,
            }}
          >
            {actionPopoverMode === "menu" ? (
              <div className="flex flex-col gap-1" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 text-left font-jp text-[12px] text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2 focus:outline-none disabled:cursor-not-allowed disabled:text-ink-4"
                  disabled={isPatching}
                  onClick={startTitleEditing}
                >
                  <span className="min-w-0 flex-1">タイトルを編集</span>
                </button>
                {work.urls.map((u) => (
                  <a
                    key={u.url}
                    role="menuitem"
                    className="flex min-h-7 w-full items-center gap-2 rounded-1 px-2 font-jp text-[12px] text-ink-1 hover:bg-paper-2 hover:text-ink-0 focus:bg-paper-2 focus:outline-none"
                    href={u.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setActionPopoverMode(null)}
                  >
                    <I.ext size={13} />
                    <span className="min-w-0 flex-1 truncate">
                      {u.label === "DLsite" ? "DLsiteを開く" : `${u.label}を開く`}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <form
                className="flex flex-col gap-2 p-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveTitle();
                }}
              >
                <input
                  ref={titleInputRef}
                  className="h-8 w-full rounded-[6px] border border-line bg-paper-1 px-2.5 font-jp text-[12px] text-ink-0 placeholder:text-ink-4 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft"
                  value={titleDraft}
                  aria-label="作品タイトル"
                  aria-invalid={titleDraft.trim().length === 0}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
                <div className="flex justify-end gap-1">
                  <Button
                    variant="quiet"
                    type="button"
                    disabled={isTitleSaving}
                    onClick={cancelTitleEditing}
                  >
                    キャンセル
                  </Button>
                  <Button
                    variant="ghost"
                    type="submit"
                    disabled={!titleDraft.trim() || isTitleSaving || isPatching}
                  >
                    保存
                  </Button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
