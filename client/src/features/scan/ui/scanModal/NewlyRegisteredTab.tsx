import type { RefObject } from "react";
import type { WorkListItem } from "@mimimilli/shared";
import { cn } from "../../../../shared/lib/cn";

export interface NewlyRegisteredTabProps {
  newWorks: WorkListItem[];
  newWorksError: string | null;
  /** insertedWorkIds総数がnewWorksより多く、表示を先頭のみに絞っているときはその総数。絞っていなければnull */
  truncatedTotal: number | null;
  editingId: string | null;
  editTitle: string;
  editSaving: boolean;
  editError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onStartEdit: (work: WorkListItem) => void;
  onChangeEditTitle: (title: string) => void;
  onSaveTitle: (workId: string) => void;
}

export default function NewlyRegisteredTab({
  newWorks,
  newWorksError,
  truncatedTotal,
  editingId,
  editTitle,
  editSaving,
  editError,
  titleInputRef,
  onStartEdit,
  onChangeEditTitle,
  onSaveTitle,
}: NewlyRegisteredTabProps) {
  if (newWorksError) {
    return (
      <p role="alert" className="font-jp text-[12px] text-[var(--r-coral)]">
        {newWorksError}
      </p>
    );
  }

  if (newWorks.length === 0) {
    return <p className="font-jp text-[12px] text-ink-3">新規に登録した作品はありません。</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-sans text-[10.5px] font-semibold tracking-[0.06em] text-ink-3 uppercase">
          新規検出した作品
        </p>
        {truncatedTotal !== null && (
          <span className="font-mono text-[10px] text-ink-4 tabular-nums">
            {newWorks.length} / {truncatedTotal} 件
          </span>
        )}
      </div>
      <ul className="flex list-none flex-col gap-1 p-0">
        {newWorks.map((work) => (
          <li key={work.id}>
            <NewWorkRow
              work={work}
              editing={editingId === work.id}
              editTitle={editTitle}
              editSaving={editingId === work.id && editSaving}
              editError={editingId === work.id ? editError : null}
              titleInputRef={titleInputRef}
              onStartEdit={() => onStartEdit(work)}
              onChangeEditTitle={onChangeEditTitle}
              onSaveTitle={() => onSaveTitle(work.id)}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NewWorkRow({
  work,
  editing,
  editTitle,
  editSaving,
  editError,
  titleInputRef,
  onStartEdit,
  onChangeEditTitle,
  onSaveTitle,
}: {
  work: WorkListItem;
  editing: boolean;
  editTitle: string;
  editSaving: boolean;
  editError: string | null;
  titleInputRef: RefObject<HTMLInputElement | null>;
  onStartEdit: () => void;
  onChangeEditTitle: (title: string) => void;
  onSaveTitle: () => void;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-[6px] border border-line-soft bg-paper-0 px-2.5 py-1.5">
      <div className="flex items-center gap-2">
        <span className="shrink-0 rounded-pill bg-[color-mix(in_oklch,var(--r-leaf)_16%,transparent)] px-1.5 py-0.5 font-sans text-[9.5px] font-semibold text-[var(--r-leaf)]">
          NEW
        </span>
        {editing ? (
          <input
            ref={titleInputRef}
            value={editTitle}
            disabled={editSaving}
            onChange={(e) => onChangeEditTitle(e.target.value)}
            onBlur={onSaveTitle}
            onKeyDown={(e) => {
              // Escapeのキャンセルは dialog の onCancel（useDialogModal）に一元化する
              if (e.key === "Enter") onSaveTitle();
            }}
            className={cn(
              "min-w-0 flex-1 rounded-[4px] border bg-paper-2 px-2 py-0.5 font-jp text-[12.5px] text-ink-0 outline-none disabled:opacity-60",
              editError ? "border-[var(--r-coral)]" : "border-acc",
            )}
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            title="クリックしてタイトルを編集"
            className="min-w-0 flex-1 truncate text-left font-jp text-[12.5px] text-ink-0"
          >
            {work.title}
          </button>
        )}
        <span className="shrink-0 font-mono text-[10.5px] text-ink-4">
          {editSaving ? "保存中…" : `${work.trackCount} tracks`}
        </span>
      </div>
      {editError && (
        <span role="alert" className="mll-selectable font-jp text-[10.5px] text-[var(--r-coral)]">
          {editError}
        </span>
      )}
    </div>
  );
}
