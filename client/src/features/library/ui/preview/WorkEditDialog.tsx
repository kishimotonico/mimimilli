import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { UrlEntry, Work } from "@mimimilli/shared";
import { isHttpAbsoluteUrl } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { canPatchWorkSource } from "../../../../entities/work/sourceRevision";
import { WorkSourcePatchBlockedNotice } from "./WorkSourcePatchBlockedNotice";
import { DlsiteEditor } from "./DlsiteEditor";
import { WorkTagEditor } from "./WorkTagEditor";

const inputClass =
  "h-8 min-w-0 w-full rounded-[6px] border border-line bg-paper-0 px-2.5 font-jp text-body text-ink-0 placeholder:text-ink-4 focus:border-acc disabled:cursor-not-allowed disabled:text-ink-4";

interface WorkEditDialogProps {
  work: Work;
  tagSuggestions: string[];
  workPatchMutations: Pick<
    ReturnType<typeof useLibraryWorkPatchMutations>,
    "titleMutation" | "tagsMutation" | "urlsMutation"
  >;
  onClose: () => void;
}

function cloneUrls(urls: UrlEntry[]): UrlEntry[] {
  return urls.map((entry) => ({ label: entry.label, url: entry.url }));
}

function urlsEqual(left: UrlEntry[], right: UrlEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function WorkEditDialog({
  work,
  tagSuggestions,
  workPatchMutations: { titleMutation, tagsMutation, urlsMutation },
  onClose,
}: WorkEditDialogProps) {
  const [titleDraft, setTitleDraft] = useState(work.title);
  const [urlDrafts, setUrlDrafts] = useState<UrlEntry[]>(() => cloneUrls(work.urls));
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose,
    initialFocusRef: titleInputRef,
  });

  useEffect(() => setTitleDraft(work.title), [work.title]);
  useEffect(() => {
    setUrlDrafts(cloneUrls(work.urls));
    setUrlValidationError(null);
  }, [work.urls]);

  const canEditSource = canPatchWorkSource(work.sourceRevision);

  const saveTitle = (event: FormEvent) => {
    event.preventDefault();
    const title = titleDraft.trim();
    if (!title || titleMutation.isPending || title === work.title) return;
    if (!canPatchWorkSource(work.sourceRevision)) return;
    titleMutation.mutate({ workId: work.id, title, sourceRevision: work.sourceRevision });
  };

  const saveUrls = (event: FormEvent) => {
    event.preventDefault();
    if (urlsMutation.isPending || !canPatchWorkSource(work.sourceRevision)) return;
    const filled: UrlEntry[] = [];
    for (const entry of urlDrafts) {
      const label = entry.label.trim();
      const url = entry.url.trim();
      if (!label && !url) continue;
      if (!label || !url) {
        setUrlValidationError("ラベルとURLの両方を入力してください");
        return;
      }
      if (!isHttpAbsoluteUrl(url)) {
        setUrlValidationError("httpまたはhttpsのURLだけを登録できます");
        return;
      }
      filled.push({ label, url });
    }
    if (urlsEqual(filled, work.urls)) return;
    setUrlValidationError(null);
    urlsMutation.mutate({ workId: work.id, urls: filled, sourceRevision: work.sourceRevision });
  };

  const titleError = titleMutation.error
    ? apiErrorMessage(titleMutation.error, "タイトルを保存できませんでした。")
    : null;
  const urlsError =
    urlValidationError ??
    (urlsMutation.error
      ? apiErrorMessage(urlsMutation.error, "関連URLを保存できませんでした。")
      : null);

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
            <WorkSourcePatchBlockedNotice sourceRevision={work.sourceRevision} />
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
                className="h-8 min-w-0 flex-1 rounded-[6px] border border-line bg-paper-0 px-2.5 font-jp text-body text-ink-0 focus:border-acc disabled:cursor-not-allowed disabled:text-ink-4"
                value={titleDraft}
                aria-invalid={titleDraft.trim().length === 0}
                disabled={titleMutation.isPending || !canEditSource}
                onChange={(event) => setTitleDraft(event.target.value)}
              />
              <Button
                type="submit"
                disabled={
                  titleDraft.trim().length === 0 ||
                  titleDraft.trim() === work.title ||
                  titleMutation.isPending ||
                  !canEditSource
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

          <form className="flex flex-col gap-2" onSubmit={saveUrls}>
            <h3
              id="work-edit-urls-title"
              className="font-sans text-[11px] font-semibold text-ink-1"
            >
              関連URL
            </h3>
            {urlDrafts.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  className={inputClass}
                  value={entry.label}
                  aria-label={`URLラベル ${index + 1}`}
                  placeholder="ラベル"
                  disabled={urlsMutation.isPending || !canEditSource}
                  onChange={(event) => {
                    const label = event.target.value;
                    setUrlDrafts((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, label } : item)),
                    );
                    if (urlValidationError) setUrlValidationError(null);
                  }}
                />
                <input
                  className={`${inputClass} font-mono text-[11px]`}
                  value={entry.url}
                  aria-label={`URL ${index + 1}`}
                  placeholder="https://"
                  disabled={urlsMutation.isPending || !canEditSource}
                  onChange={(event) => {
                    const url = event.target.value;
                    setUrlDrafts((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, url } : item)),
                    );
                    if (urlValidationError) setUrlValidationError(null);
                  }}
                />
                <IconButton
                  icon={I.x}
                  label={`URL ${index + 1} を削除`}
                  size="xs"
                  disabled={urlsMutation.isPending || !canEditSource}
                  onClick={() => {
                    setUrlDrafts((prev) => prev.filter((_, i) => i !== index));
                    if (urlValidationError) setUrlValidationError(null);
                  }}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={urlsMutation.isPending || !canEditSource}
                onClick={() => setUrlDrafts((prev) => [...prev, { label: "", url: "" }])}
              >
                URLを追加
              </Button>
              <Button
                type="submit"
                disabled={
                  urlsMutation.isPending ||
                  !canEditSource ||
                  urlsEqual(
                    urlDrafts
                      .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
                      .filter((entry) => entry.label || entry.url),
                    work.urls,
                  )
                }
              >
                関連URLを保存
              </Button>
            </div>
            {urlsError && (
              <p className="mle-prv__edit-error" role="alert">
                {urlsError}
              </p>
            )}
          </form>

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
