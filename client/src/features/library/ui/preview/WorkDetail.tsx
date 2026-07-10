import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Work, WorkPatch } from "@mimimilli/shared";
import CoverImg from "../../../../entities/work/ui/CoverImg";
import Tag from "../../../../entities/work/ui/Tag";
import { parseTag } from "../../../../entities/work/model";
import { buildWorkPatchTags, getEditableFlatTags } from "../../../../entities/work/editableTags";
import { I } from "../../../../shared/ui/Icon";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import TagCombobox from "../../../../shared/ui/TagCombobox";
import Toast from "../../../../shared/ui/Toast";
import { formatDuration, formatTime } from "../../../../shared/lib/format";
import { formatDate } from "./format";

const TAG_UNDO_TOAST_MS = 6000;

const TAG_POPOVER_WIDTH = 220;
const ACTION_POPOVER_WIDTH = 240;
const POPOVER_MARGIN = 8;

interface PopoverLayout {
  left: number;
  width: number;
}

function getClampedPopoverLayout(anchor: HTMLElement, preferredWidth: number): PopoverLayout {
  const anchorRect = anchor.getBoundingClientRect();
  const container = anchor.closest(".mle-prv__body") as HTMLElement | null;
  const containerRect = container?.getBoundingClientRect();
  const visibleLeft = (containerRect?.left ?? 0) + POPOVER_MARGIN;
  const visibleRight = (containerRect?.right ?? window.innerWidth) - POPOVER_MARGIN;
  const availableWidth = Math.max(0, visibleRight - visibleLeft);
  const width = Math.min(preferredWidth, availableWidth);
  const minLeft = visibleLeft - anchorRect.left;
  const maxLeft = visibleRight - width - anchorRect.left;
  const left = maxLeft < minLeft ? minLeft : Math.min(Math.max(0, minLeft), maxLeft);

  return { left, width };
}

interface WorkDetailProps {
  work: Work;
  onPlay: (trackIndex: number) => void;
  onResume: () => void;
  playingTrackIndex: number | null;
  tagSuggestions: string[];
  isPatching: boolean;
  onPatchWork: (body: WorkPatch) => Promise<Work>;
}

export function WorkDetail({
  work,
  onPlay,
  onResume,
  playingTrackIndex,
  tagSuggestions,
  isPatching,
  onPatchWork,
}: WorkDetailProps) {
  const playlist =
    work.playlists.find((p) => p.name === (work.defaultPlaylist ?? "default")) ?? work.playlists[0];
  const tracks = playlist?.tracks ?? [];
  const isPlayable = work.status === "ok";
  const hasResume =
    work.resumePosition > 0 && work.resumeTrackIndex >= 0 && work.resumeTrackIndex < tracks.length;
  const resumeTrack = hasResume ? tracks[work.resumeTrackIndex] : null;
  const resumeTime = formatTime(work.resumePosition);
  const [actionPopoverMode, setActionPopoverMode] = useState<"menu" | "title" | null>(null);
  const [actionPopoverLayout, setActionPopoverLayout] = useState<PopoverLayout>({
    left: 0,
    width: ACTION_POPOVER_WIDTH,
  });
  const [titleDraft, setTitleDraft] = useState(work.title);
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [tagPopoverLayout, setTagPopoverLayout] = useState<PopoverLayout>({
    left: 0,
    width: TAG_POPOVER_WIDTH,
  });
  const [isTagSaving, setIsTagSaving] = useState(false);
  const [isBookmarkSaving, setIsBookmarkSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [pendingRemoveTag, setPendingRemoveTag] = useState<string | null>(null);
  const [failedRemoveTag, setFailedRemoveTag] = useState<string | null>(null);
  const [tagUndoToast, setTagUndoToast] = useState<string | null>(null);
  const tagPopoverRef = useRef<HTMLDivElement | null>(null);
  const actionPopoverRef = useRef<HTMLDivElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
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

  useEffect(() => {
    if (actionPopoverMode !== "title") return;
    titleInputRef.current?.focus({ preventScroll: true });
  }, [actionPopoverMode]);

  useEffect(() => {
    if (!isTagPopoverOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        tagPopoverRef.current &&
        event.target instanceof Node &&
        !tagPopoverRef.current.contains(event.target)
      ) {
        setIsTagPopoverOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsTagPopoverOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isTagPopoverOpen]);

  useEffect(() => {
    if (!actionPopoverMode) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (
        actionPopoverRef.current &&
        event.target instanceof Node &&
        !actionPopoverRef.current.contains(event.target)
      ) {
        setActionPopoverMode(null);
        setTitleDraft(work.title);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionPopoverMode(null);
        setTitleDraft(work.title);
        setEditError(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionPopoverMode, work.title]);

  useLayoutEffect(() => {
    if (!isTagPopoverOpen) return;

    const updateTagPopoverLayout = () => {
      const anchor = tagPopoverRef.current;
      if (!anchor) return;

      const nextLayout = getClampedPopoverLayout(anchor, TAG_POPOVER_WIDTH);

      setTagPopoverLayout((current) =>
        current.left === nextLayout.left && current.width === nextLayout.width
          ? current
          : nextLayout,
      );
    };

    updateTagPopoverLayout();
    window.addEventListener("resize", updateTagPopoverLayout);
    window.addEventListener("scroll", updateTagPopoverLayout, true);

    return () => {
      window.removeEventListener("resize", updateTagPopoverLayout);
      window.removeEventListener("scroll", updateTagPopoverLayout, true);
    };
  }, [isTagPopoverOpen]);

  useLayoutEffect(() => {
    if (!actionPopoverMode) return;

    const updateActionPopoverLayout = () => {
      const anchor = actionPopoverRef.current;
      if (!anchor) return;

      const nextLayout = getClampedPopoverLayout(anchor, ACTION_POPOVER_WIDTH);

      setActionPopoverLayout((current) =>
        current.left === nextLayout.left && current.width === nextLayout.width
          ? current
          : nextLayout,
      );
    };

    updateActionPopoverLayout();
    window.addEventListener("resize", updateActionPopoverLayout);
    window.addEventListener("scroll", updateActionPopoverLayout, true);

    return () => {
      window.removeEventListener("resize", updateActionPopoverLayout);
      window.removeEventListener("scroll", updateActionPopoverLayout, true);
    };
  }, [actionPopoverMode]);

  const startTitleEditing = () => {
    setTitleDraft(work.title);
    setEditError(null);
    setActionPopoverMode("title");
  };

  const cancelTitleEditing = () => {
    setTitleDraft(work.title);
    setEditError(null);
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
    setEditError(null);
    try {
      await onPatchWork({ title });
      setActionPopoverMode(null);
    } catch {
      setEditError("タイトルを保存できませんでした。");
    } finally {
      setIsTitleSaving(false);
    }
  };

  const patchFlatTags = async (nextFlatTags: string[]): Promise<boolean> => {
    if (isPatching || isTagSaving) return false;
    const tags = buildWorkPatchTags(work.tags, nextFlatTags);
    setIsTagSaving(true);
    setEditError(null);
    try {
      await onPatchWork({ tags });
      return true;
    } catch {
      setEditError("タグを保存できませんでした。");
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

    setIsTagPopoverOpen(false);
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
    // 復元に失敗した場合はトーストを残して再試行可能にする（editError も表示される）
    const restored = editableFlatTags.includes(tag)
      ? editableFlatTags
      : [...editableFlatTags, tag];
    const ok = await patchFlatTags(restored);
    if (ok) {
      if (tagUndoTimerRef.current) clearTimeout(tagUndoTimerRef.current);
      setTagUndoToast(null);
    }
  };

  const toggleBookmark = async () => {
    if (isPatching) return;
    setIsBookmarkSaving(true);
    setEditError(null);
    try {
      await onPatchWork({ bookmarked: !work.bookmarked });
    } catch {
      setEditError("ブックマークを更新できませんでした。");
    } finally {
      setIsBookmarkSaving(false);
    }
  };

  return (
    <div className="mle-prv__body">
      <div className="mle-prv__hero">
        <div className="mle-prv__cover">
          <CoverImg
            id={work.id}
            title={work.title}
            hasCover={!!work.coverImage}
            size={140}
            radius={6}
          />
        </div>
        <div className="mle-prv__meta">
          <div className="mle-prv__kicker">
            {work.status === "ok" && <span className="reg">登録済</span>}
            {work.status === "missing" && (
              <span className="warn">
                <I.err size={11} /> ファイル欠損
              </span>
            )}
            {work.status === "error" && (
              <span className="warn">
                <I.err size={11} /> メタ読み込みエラー
              </span>
            )}
            <span className="inline-flex items-center gap-[3px] tracking-normal">
              <span className="font-sans text-[9.5px] text-ink-4">追加</span>
              <span className="font-mono text-[10px] text-ink-2">{formatDate(work.addedAt)}</span>
            </span>
            {work.lastPlayedAt && (
              <>
                <span className="text-ink-4">·</span>
                <span className="inline-flex items-center gap-[3px] tracking-normal">
                  <span className="font-sans text-[9.5px] text-ink-4">最終再生</span>
                  <span className="font-mono text-[10px] text-ink-2">
                    {formatDate(work.lastPlayedAt)}
                  </span>
                </span>
              </>
            )}
          </div>
          <div className="mle-prv__title-row">
            <h2 className="mle-prv__title">{work.title}</h2>
          </div>
          {(work.totalDurationSec > 0 || tracks.length > 0) && (
            <div className="mle-prv__row">
              {tracks.length > 0 && <span>{tracks.length} トラック</span>}
              {work.totalDurationSec > 0 && (
                <>
                  <span className="dot">·</span>
                  <span>{formatDuration(work.totalDurationSec)}</span>
                </>
              )}
            </div>
          )}
          <div className="mle-prv__tag-row">
            <div className="mle-prv__tags">
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
              <div ref={tagPopoverRef} className="relative inline-flex">
                <IconButton
                  icon={I.add}
                  label="タグを追加"
                  size="sm"
                  className="h-5 w-5 rounded-1 bg-paper-2 text-ink-2 hover:bg-paper-3 hover:text-ink-0"
                  disabled={isTagSaving || isPatching}
                  onClick={() => {
                    setEditError(null);
                    setIsTagPopoverOpen((open) => !open);
                  }}
                />
                {isTagPopoverOpen && (
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
                      onSelect={(tag) => void addFlatTag(tag)}
                      onCancel={() => setIsTagPopoverOpen(false)}
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
            onDismiss={() => setTagUndoToast(null)}
          />
          {editError && (
            <p className="mle-prv__edit-error" role="alert">
              {editError}
            </p>
          )}
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
                <IconButton
                  icon={I.refresh}
                  label="最初から再生"
                  size="sm"
                  onClick={() => onPlay(0)}
                />
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
                  setEditError(null);
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
        </div>
      </div>

      {work.status === "missing" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">ファイルが見つかりません</p>
            <p className="mle-prv__warn-text">
              登録時のフォルダーが移動または削除された可能性があります。再生はできません。
            </p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
          </div>
        </div>
      )}

      {work.status === "error" && (
        <div className="mle-prv__warn">
          <I.err size={16} />
          <div className="mle-prv__warn-body">
            <p className="mle-prv__warn-title">メタデータの読み込みに失敗しました</p>
            <p className="mle-prv__warn-text">
              {work.errorMessage ?? "詳細不明のエラーが発生しました。"}
            </p>
            <p className="mle-prv__warn-path">{work.physicalPath}</p>
          </div>
        </div>
      )}

      {tracks.length > 0 && (
        <>
          <div className="mle-sect">
            <span>トラック</span>
            <div className="mle-sect__rule" />
          </div>
          <div className="mle-prv__tracks">
            {tracks.map((tr, i) => (
              <button
                type="button"
                key={i}
                className={`mle-prv__trk ${playingTrackIndex === i ? "is-now" : ""} ${hasResume && work.resumeTrackIndex === i ? "is-resume" : ""} ${!isPlayable ? "is-disabled" : ""}`}
                disabled={!isPlayable}
                onClick={() => {
                  if (isPlayable) onPlay(i);
                }}
              >
                <span className="num">{String(i + 1).padStart(2, "0")}</span>
                <span className="name">
                  <span className="title">{tr.title}</span>
                  {hasResume && work.resumeTrackIndex === i && (
                    <span className="resume">再開 {formatTime(work.resumePosition)}</span>
                  )}
                </span>
                {tr.end != null && tr.start != null && (
                  <span className="dur">{formatDuration(Math.round(tr.end - tr.start))}</span>
                )}
                <div className="src">
                  <span className="mle-icbtn" title="再生" aria-disabled={!isPlayable}>
                    <I.play size={11} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
