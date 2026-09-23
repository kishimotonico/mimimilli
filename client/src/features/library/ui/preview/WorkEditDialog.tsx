import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import type { UrlEntry, Work } from "@mimimilli/shared";
import { isHttpAbsoluteUrl } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import TextInput from "../../../../shared/ui/TextInput";
import { useToast } from "../../../../shared/ui/useToast";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { apiErrorMessage } from "../../../../shared/lib/apiError";
import { getWorkEditSnapshot } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import { sourceEditErrorMessage } from "../../../../entities/work/sourceRevision";
import { WorkSourcePatchBlockedNotice } from "./WorkSourcePatchBlockedNotice";
import { DlsiteEditor } from "./DlsiteEditor";
import { WorkTagEditor } from "./WorkTagEditor";

interface WorkEditDialogProps {
  work: Work;
  tagSuggestions: string[];
  workPatchMutations: Pick<
    ReturnType<typeof useLibraryWorkPatchMutations>,
    "titleMutation" | "addTagMutation" | "removeTagMutation" | "urlsMutation"
  >;
  onClose: () => void;
}

function cloneUrls(urls: UrlEntry[]): UrlEntry[] {
  return urls.map((entry) => ({ label: entry.label, url: entry.url }));
}

function urlsEqual(left: UrlEntry[], right: UrlEntry[]): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

/** ラベル・URLの入力欄群を検証済みのUrlEntry[]へ正規化する。不正な入力があれば
 *  setValidationError でエラー文言を出し、nullを返す（保存を続行しない合図）。 */
function buildFilledUrls(
  drafts: UrlEntry[],
  setValidationError: (message: string | null) => void,
): UrlEntry[] | null {
  const filled: UrlEntry[] = [];
  for (const entry of drafts) {
    const label = entry.label.trim();
    const url = entry.url.trim();
    if (!label && !url) continue;
    if (!label || !url) {
      setValidationError("ラベルとURLの両方を入力してください");
      return null;
    }
    if (!isHttpAbsoluteUrl(url)) {
      setValidationError("httpまたはhttpsのURLだけを登録できます");
      return null;
    }
    filled.push({ label, url });
  }
  setValidationError(null);
  return filled;
}

interface UnsavedChangesPromptProps {
  canSave: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

/** dirty状態での閉じ操作（Escape・×・背景クリック）を受けたときに割り込む3択プロンプト。
 *  ConfirmDialogは2択専用のため、保存を含む3択はここで別実装する。 */
function UnsavedChangesPrompt({
  canSave,
  isSaving,
  onSave,
  onDiscard,
  onCancel,
}: UnsavedChangesPromptProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: onCancel,
    initialFocusRef: cancelRef,
  });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。
    <dialog
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label="未保存の変更があります"
      onCancel={handleCancel}
      onClick={(event) => handleBackdropClick(event)}
      className="m-auto w-[360px] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-[18px_18px_14px] font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      <div className="flex flex-col gap-2.5">
        <span className="font-sans text-[13.5px] font-semibold text-ink-0">
          未保存の変更があります
        </span>
        <p className="m-0 text-body leading-[1.7] text-ink-1">
          保存せずに閉じると、入力した内容は失われます。
        </p>
        <div className="mt-1 flex justify-end gap-2">
          <Button ref={cancelRef} variant="quiet" size="md" onClick={onCancel} disabled={isSaving}>
            キャンセル
          </Button>
          {/* 未保存内容を失う操作なのでdanger（solid塗り）扱いにする */}
          <Button variant="danger" size="md" onClick={onDiscard} disabled={isSaving}>
            破棄する
          </Button>
          <Button variant="primary" size="md" onClick={onSave} disabled={!canSave || isSaving}>
            保存する
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export function WorkEditDialog({
  work,
  tagSuggestions,
  workPatchMutations: { titleMutation, addTagMutation, removeTagMutation, urlsMutation },
  onClose,
}: WorkEditDialogProps) {
  const sourceQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.source(work.id),
    queryFn: () => getWorkEditSnapshot(work.id),
  });
  const snapshot = sourceQuery.data;
  const sourceErrorMessage = sourceQuery.error
    ? sourceEditErrorMessage(sourceQuery.error, "作品情報を読み込めないため編集できません。")
    : null;
  const canEditSource = Boolean(snapshot) && !sourceQuery.isError;

  const [titleDraft, setTitleDraft] = useState(work.title);
  const [urlDrafts, setUrlDrafts] = useState<UrlEntry[]>(() => cloneUrls(work.urls));
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
  const [isSavingToClose, setIsSavingToClose] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const firstUrlInputRef = useRef<HTMLInputElement>(null);

  const requestClose = () => {
    if (isDirty) {
      setIsUnsavedPromptOpen(true);
      return;
    }
    onClose();
  };

  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({
    onClose: requestClose,
    initialFocusRef: titleInputRef,
  });

  const snapshotTitle = snapshot?.title;
  const snapshotUrls = snapshot?.urls;
  useEffect(() => {
    if (snapshotTitle !== undefined) setTitleDraft(snapshotTitle);
  }, [snapshotTitle]);
  useEffect(() => {
    if (!snapshotUrls) return;
    setUrlDrafts(cloneUrls(snapshotUrls));
    setUrlValidationError(null);
  }, [snapshotUrls]);
  useEffect(() => {
    if (titleMutation.error) titleInputRef.current?.focus();
  }, [titleMutation.error]);
  useEffect(() => {
    if (urlsMutation.error) firstUrlInputRef.current?.focus();
  }, [urlsMutation.error]);

  const currentTitle = snapshot?.title ?? work.title;
  const currentUrls = snapshot?.urls ?? work.urls;
  const trimmedTitle = titleDraft.trim();
  const isTitleDirty = trimmedTitle !== currentTitle;
  const normalizedUrlDrafts = urlDrafts
    .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
    .filter((entry) => entry.label || entry.url);
  const isUrlsDirty = !urlsEqual(normalizedUrlDrafts, currentUrls);
  const isDirty = isTitleDirty || isUrlsDirty;

  const saveTitle = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || titleMutation.isPending || !trimmedTitle || trimmedTitle === snapshot.title)
      return;
    titleMutation.mutate({
      workId: work.id,
      title: trimmedTitle,
      sourceRevision: snapshot.sourceRevision,
    });
  };

  const saveUrls = (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || urlsMutation.isPending) return;
    const filled = buildFilledUrls(urlDrafts, setUrlValidationError);
    if (filled === null) return;
    if (urlsEqual(filled, snapshot.urls)) return;
    urlsMutation.mutate({ workId: work.id, urls: filled, sourceRevision: snapshot.sourceRevision });
  };

  const discardAndClose = () => {
    setIsUnsavedPromptOpen(false);
    onClose();
  };

  const saveAndClose = async () => {
    if (!snapshot) return;
    if (isTitleDirty && !trimmedTitle) return;
    const filledUrls = isUrlsDirty ? buildFilledUrls(urlDrafts, setUrlValidationError) : null;
    if (isUrlsDirty && filledUrls === null) {
      setIsUnsavedPromptOpen(false);
      return;
    }
    setIsSavingToClose(true);
    try {
      let sourceRevision = snapshot.sourceRevision;
      if (isTitleDirty) {
        const updated = await titleMutation.mutateAsync({
          workId: work.id,
          title: trimmedTitle,
          sourceRevision,
        });
        sourceRevision = updated.snapshot.sourceRevision;
      }
      if (isUrlsDirty && filledUrls) {
        await urlsMutation.mutateAsync({ workId: work.id, urls: filledUrls, sourceRevision });
      }
      setIsUnsavedPromptOpen(false);
      onClose();
    } catch {
      setIsUnsavedPromptOpen(false);
    } finally {
      setIsSavingToClose(false);
    }
  };

  const titleError = titleMutation.error
    ? apiErrorMessage(titleMutation.error, "タイトルを保存できませんでした。")
    : null;
  const urlsMutationError = urlsMutation.error
    ? apiErrorMessage(urlsMutation.error, "関連URLを保存できませんでした。")
    : null;

  const { show: showToast, dismiss: dismissToast } = useToast();
  useEffect(() => {
    const message = titleError ?? urlsMutationError;
    if (!message) {
      dismissToast();
      return;
    }
    showToast({
      message,
      variant: "error",
      priority: "action",
      onDismiss: titleError ? titleMutation.reset : urlsMutation.reset,
    });
  }, [
    titleError,
    urlsMutationError,
    titleMutation.reset,
    urlsMutation.reset,
    showToast,
    dismissToast,
  ]);

  const editorWork = snapshot
    ? { ...work, title: snapshot.title, tags: snapshot.tags, urls: snapshot.urls }
    : work;

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックはuseDialogModalで判定する。 */}
      <dialog
        ref={dialogRef}
        aria-labelledby="work-edit-title"
        onCancel={handleCancel}
        onClick={(event) => handleBackdropClick(event)}
        className="m-auto w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
      >
        <div className="flex max-h-[calc(100vh-32px)] min-h-0 flex-col overflow-hidden">
          <header className="flex shrink-0 items-center gap-2 border-b border-line-soft px-[18px] py-3">
            <h2 id="work-edit-title" className="min-w-0 flex-1 font-sans text-[14px] font-semibold">
              作品を編集
            </h2>
            <IconButton icon={I.x} label="閉じる" size="sm" onClick={requestClose} />
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
            <form className="flex flex-col gap-2" onSubmit={saveTitle}>
              <WorkSourcePatchBlockedNotice message={sourceErrorMessage} />
              <label
                htmlFor="work-title-input"
                className="font-sans text-label font-semibold text-ink-1"
              >
                タイトル
              </label>
              <div className="flex items-center gap-2">
                <TextInput
                  ref={titleInputRef}
                  id="work-title-input"
                  font="jp"
                  className="flex-1"
                  value={titleDraft}
                  aria-invalid={titleDraft.trim().length === 0}
                  disabled={titleMutation.isPending || !canEditSource}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
                <Button
                  type="submit"
                  disabled={
                    titleDraft.trim().length === 0 ||
                    trimmedTitle === currentTitle ||
                    titleMutation.isPending ||
                    !canEditSource
                  }
                >
                  タイトルを保存
                </Button>
              </div>
            </form>

            <section aria-labelledby="work-edit-tags-title" className="flex flex-col gap-2">
              <h3
                id="work-edit-tags-title"
                className="font-sans text-label font-semibold text-ink-1"
              >
                タグ
              </h3>
              <WorkTagEditor
                work={editorWork}
                tagSuggestions={tagSuggestions}
                addTagMutation={addTagMutation}
                removeTagMutation={removeTagMutation}
                expanded
              />
            </section>

            <form className="flex flex-col gap-2" onSubmit={saveUrls}>
              <h3
                id="work-edit-urls-title"
                className="font-sans text-label font-semibold text-ink-1"
              >
                関連URL
              </h3>
              {urlDrafts.map((entry, index) => (
                <div key={index} className="flex items-center gap-2">
                  <TextInput
                    ref={index === 0 ? firstUrlInputRef : undefined}
                    font="jp"
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
                  <TextInput
                    font="mono"
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
                      currentUrls,
                    )
                  }
                >
                  関連URLを保存
                </Button>
              </div>
              {urlValidationError && (
                <p className="mle-prv__edit-error" role="alert">
                  {urlValidationError}
                </p>
              )}
            </form>

            <div className="border-t border-line-soft pt-4">
              {snapshot ? <DlsiteEditor workId={work.id} snapshot={snapshot} /> : null}
            </div>
          </div>
          <footer className="flex shrink-0 justify-end border-t border-line-soft px-[18px] py-3">
            <Button variant="quiet" onClick={requestClose}>
              閉じる
            </Button>
          </footer>
        </div>
      </dialog>
      {isUnsavedPromptOpen && (
        <UnsavedChangesPrompt
          canSave={canEditSource && !(isTitleDirty && !trimmedTitle)}
          isSaving={isSavingToClose}
          onSave={() => void saveAndClose()}
          onDiscard={discardAndClose}
          onCancel={() => setIsUnsavedPromptOpen(false)}
        />
      )}
    </>
  );
}
