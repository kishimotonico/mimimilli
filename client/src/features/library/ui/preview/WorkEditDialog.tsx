import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { Work } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { DlsiteEditor } from "./DlsiteEditor";
import { WorkTagEditor } from "./WorkTagEditor";

interface WorkEditDialogProps {
  work: Work;
  tagSuggestions: string[];
  workPatchMutations: Pick<
    ReturnType<typeof useLibraryWorkPatchMutations>,
    "titleMutation" | "tagsMutation"
  >;
  onClose: () => void;
}

export function WorkEditDialog({
  work,
  tagSuggestions,
  workPatchMutations: { titleMutation, tagsMutation },
  onClose,
}: WorkEditDialogProps) {
  const [titleDraft, setTitleDraft] = useState(work.title);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose,
    initialFocusRef: titleInputRef,
  });

  useEffect(() => setTitleDraft(work.title), [work.title]);

  const saveTitle = (event: FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title || titleMutation.isPending || title === work.title) return;
    titleMutation.mutate({ workId: work.id, title, sourceRevision: work.sourceRevision ?? "" });
  };

  const titleError = titleMutation.error
    ? apiErrorMessage(titleMutation.error, "タイトルを保存できませんでした。")
    : null;

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      aria-labelledby="work-edit-title"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
      className="m-auto w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex max-h-[calc(100vh-32px)] min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center border-b border-line-soft px-[18px] py-[14px]">
          <h2 id="work-edit-title" className="min-w-0 flex-1 font-sans text-[14px] font-semibold">
            作品を編集
          </h2>
          <IconButton icon={I.x} label="閉じる" size="sm" onClick={onClose} />
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
          <form className="flex flex-col gap-2" onSubmit={saveTitle}>
            <label
              htmlFor="work-title-input"
              className="font-sans text-[11px] font-semibold text-ink-1"
            >
              タイトル
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={titleInputRef}
                id="work-title-input"
                className="h-8 min-w-0 flex-1 rounded-[6px] border border-line bg-paper-0 px-2.5 font-jp text-[12px] text-ink-0 focus:border-acc focus:outline-none focus:ring-2 focus:ring-acc-soft disabled:cursor-not-allowed disabled:text-ink-4"
                value={titleDraft}
                aria-invalid={titleDraft.trim().length === 0}
                disabled={titleMutation.isPending}
                onChange={(event) => setTitleDraft(event.target.value)}
              />
              <Button
                type="submit"
                disabled={
                  !titleDraft.trim() || titleDraft.trim() === work.title || titleMutation.isPending
                }
              >
                タイトルを保存
              </Button>
            </div>
            {titleError && (
              <p className="mle-prv__edit-error" role="alert">
                {titleError}
              </p>
            )}
          </form>

          <section aria-labelledby="work-edit-tags-title" className="flex flex-col gap-2">
            <h3
              id="work-edit-tags-title"
              className="font-sans text-[11px] font-semibold text-ink-1"
            >
              タグ
            </h3>
            <WorkTagEditor
              work={work}
              tagSuggestions={tagSuggestions}
              tagsMutation={tagsMutation}
              expanded
            />
          </section>

          <div className="border-t border-line-soft pt-4">
            <DlsiteEditor work={work} />
          </div>
        </div>
        <footer className="flex shrink-0 justify-end border-t border-line-soft px-[18px] py-3">
          <Button variant="quiet" onClick={onClose}>
            閉じる
          </Button>
        </footer>
      </div>
    </dialog>
  );
}
