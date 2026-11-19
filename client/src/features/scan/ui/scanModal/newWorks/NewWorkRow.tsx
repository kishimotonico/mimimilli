/* oxlint-disable jsx-a11y/prefer-tag-over-role -- 仮想リストの行は絶対配置の div で組むため、tr/td ではなく role=row/cell で ARIA table 構造を与える */
import { hasRjCode, type WorkListItem, type WorkspacePath } from "@mimimilli/shared";
import CoverImg from "../../../../../entities/work/ui/CoverImg";
import { selectFixedCoverThumbnailWidth } from "../../../../../entities/work/ui/coverThumbnailWidth";
import { cn } from "../../../../../shared/lib/cn";
import { I } from "../../../../../shared/ui/Icon";
import StatusLabel from "../../../../../shared/ui/StatusLabel";
import { useInlineEditKeyDown } from "../../../../../shared/ui/useInlineEditKeyDown";
import { newWorkDlsiteLink } from "../../../model/newWorkDlsiteLink";
import { PathLink } from "../ScanLinks";
import { EDIT_FIELD_CLASS, NEW_WORKS_GRID_CLASS, ROW_HEIGHT } from "./layout";
import type { InlineTitleEdit } from "./useInlineTitleEdit";

interface NewWorkRowProps {
  work: WorkListItem;
  edit: InlineTitleEdit;
  onOpenFiles: (path: WorkspacePath) => void;
  onOpenWorkDetail: (workId: string) => void;
}

export default function NewWorkRow({ work, edit, onOpenFiles, onOpenWorkDetail }: NewWorkRowProps) {
  const editing = edit.editingId === work.id;
  const editError = edit.editErrorFor(work.id);
  const handleKeyDown = useInlineEditKeyDown({
    onCommit: () => edit.saveTitle(work.id),
    onCancel: edit.cancelEdit,
  });
  const link = newWorkDlsiteLink(work.dlsite);

  return (
    <div
      role="row"
      style={{ height: ROW_HEIGHT }}
      className={cn(NEW_WORKS_GRID_CLASS, "group border-b border-line-soft")}
    >
      <div role="cell" className="flex items-center">
        <CoverImg
          id={work.id}
          title={work.title}
          cover={work.cover}
          size={36}
          radius={4}
          requestWidth={selectFixedCoverThumbnailWidth(36, window.devicePixelRatio)}
          loading="lazy"
        />
      </div>
      <div role="cell" className="flex min-w-0 flex-col justify-center gap-0.5">
        <div className="flex min-w-0 items-center gap-1">
          {editing ? (
            <input
              ref={edit.titleInputRef}
              aria-label="タイトル"
              value={edit.editTitle}
              disabled={edit.editSaving}
              onChange={(event) => edit.changeTitle(event.target.value)}
              onBlur={() => edit.saveTitle(work.id)}
              onKeyDown={handleKeyDown}
              className={cn(
                EDIT_FIELD_CLASS,
                "w-full bg-paper-2 text-ink-0 disabled:opacity-60",
                editError ? "border-[var(--r-coral)]" : "border-acc",
              )}
            />
          ) : (
            <>
              <button
                type="button"
                onClick={() => edit.startEdit(work)}
                className={cn(
                  EDIT_FIELD_CLASS,
                  "min-w-0 truncate border-transparent text-left text-ink-0 hover:border-line-soft hover:bg-paper-2",
                )}
              >
                {work.title}
              </button>
              <button
                type="button"
                title="作品詳細を開く"
                onClick={() => onOpenWorkDetail(work.id)}
                className="shrink-0 rounded-[4px] p-0.5 text-ink-3 opacity-0 transition-opacity hover:text-ink-0 focus-visible:opacity-100 group-hover:opacity-100"
              >
                <I.ext size={12} />
              </button>
            </>
          )}
        </div>
        {editError ? (
          <span
            role="alert"
            className="mll-selectable truncate px-1.5 font-jp text-caption text-[var(--r-coral)]"
          >
            {editError}
          </span>
        ) : (
          <span className="flex min-w-0 px-1.5">
            <PathLink path={work.relativePath} onOpen={onOpenFiles} />
          </span>
        )}
      </div>
      <div role="cell" className="min-w-0 truncate font-mono text-mono text-ink-2">
        {hasRjCode(work.dlsite) ? work.dlsite.rjCode : ""}
      </div>
      <div role="cell" className="flex items-center">
        {link === "linked" && (
          <StatusLabel tone="done" icon={I.link}>
            連携済み
          </StatusLabel>
        )}
        {link === "unlinked" && (
          <StatusLabel tone="none" icon={I.linkOff} className="text-ink-3">
            未連携
          </StatusLabel>
        )}
      </div>
    </div>
  );
}
