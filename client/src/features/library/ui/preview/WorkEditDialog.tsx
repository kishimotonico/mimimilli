import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  NormalizedTag,
  UrlEntry,
  Work,
  WorkEditSnapshot,
  WorkProjection,
} from "@mimimilli/shared";
import { isHttpAbsoluteUrl } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import IconButton from "../../../../shared/ui/IconButton";
import { I } from "../../../../shared/ui/Icon";
import TextInput from "../../../../shared/ui/TextInput";
import { ApiRequestError } from "../../../../shared/api/http";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { getWorkEditSnapshot } from "../../../../entities/work/api";
import { WORK_QUERY_KEYS } from "../../../../entities/work/queryKeys";
import {
  projectionWorkspacePath,
  sourceMutationErrorMessage,
} from "../../../../entities/work/sourceMutation";
import { SourceProjectionNotice } from "../../../../entities/work/ui/SourceProjectionNotice";
import { useRootFolderOrNull } from "../../../../entities/settings/useSettingsQuery";
import { useTagPrefixes } from "../../../../entities/tag/useTagPrefixes";
import {
  reconcileWorkEditSnapshot,
  tagsEqual,
  urlsEqual,
  type WorkEditField,
} from "../../model/workEditReconcile";
import { interpretWorkEditSaveResult } from "../../model/workEditSaveResult";
import { WorkSourcePatchBlockedNotice } from "./WorkSourcePatchBlockedNotice";
import { DlsiteEditor } from "./DlsiteEditor";
import { WorkEditTagsField } from "./WorkEditTagsField";
import { useWorkEditTagsDraft } from "./useWorkEditTagsDraft";

interface WorkEditDialogProps {
  work: Work;
  tagSuggestions: string[];
  workPatchMutations: Pick<ReturnType<typeof useLibraryWorkPatchMutations>, "editMutation">;
  onClose: () => void;
}

const SOURCE_CHANGED_MESSAGE = "作品データが他で更新されました。最新の内容を確認しています…";

const FIELD_LABEL: Record<WorkEditField, string> = {
  title: "タイトル",
  tags: "タグ",
  urls: "関連URL",
};

function cloneUrls(urls: UrlEntry[]): UrlEntry[] {
  return urls.map((entry) => ({ label: entry.label, url: entry.url }));
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

/** 保存後に外部（DlsiteEditorの独立適用・409後の再取得など）で編集中のフィールドが
 *  さらに変わったときの選び直し導線。 */
function FieldConflictNotice({
  field,
  onUseLatest,
  onKeepMine,
}: {
  field: WorkEditField;
  onUseLatest: () => void;
  onKeepMine: () => void;
}) {
  return (
    <div className="mle-prv__edit-conflict" role="alert">
      <p>保存後に別の変更がありました（{FIELD_LABEL[field]}）</p>
      <div className="actions">
        <Button variant="ghost" size="sm" onClick={onUseLatest}>
          最新の値を使う
        </Button>
        <Button variant="ghost" size="sm" onClick={onKeepMine}>
          自分の編集で上書きする
        </Button>
      </div>
    </div>
  );
}

export function WorkEditDialog({
  work,
  tagSuggestions,
  workPatchMutations: { editMutation },
  onClose,
}: WorkEditDialogProps) {
  const queryClient = useQueryClient();
  const sourceQuery = useQuery({
    queryKey: WORK_QUERY_KEYS.source(work.id),
    queryFn: () => getWorkEditSnapshot(work.id),
  });
  const { tagPrefixes } = useTagPrefixes();

  const [acceptedSnapshot, setAcceptedSnapshot] = useState<WorkEditSnapshot | null>(null);
  const [processedRevision, setProcessedRevision] = useState<string | null>(null);
  const [titleDraft, setTitleDraft] = useState(work.title);
  const [tagsDraft, setTagsDraft] = useState<NormalizedTag[]>(work.tags);
  const [urlDrafts, setUrlDrafts] = useState<UrlEntry[]>(() => cloneUrls(work.urls));
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);
  const [isUnsavedPromptOpen, setIsUnsavedPromptOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  // source確定（保存成功）とcatalog反映は別の事実（ADR-0025）。
  // projectionがpendingでも保存自体は成功として扱い、反映状況だけをここに残す。
  const [projection, setProjection] = useState<WorkProjection | null>(null);
  const rootFolder = useRootFolderOrNull();

  // 保存後・DlsiteEditorの独立適用・409後の再取得などで届いた新しいsnapshotを
  // 基準へ取り込むかどうかの状態。
  const [pendingSnapshot, setPendingSnapshot] = useState<WorkEditSnapshot | null>(null);
  const [pendingChangedFields, setPendingChangedFields] = useState<WorkEditField[]>([]);
  const [conflictFields, setConflictFields] = useState<WorkEditField[]>([]);
  const [keepMineFields, setKeepMineFields] = useState<ReadonlySet<WorkEditField>>(new Set());

  const titleInputRef = useRef<HTMLInputElement>(null);
  const firstUrlInputRef = useRef<HTMLInputElement>(null);

  const trimmedTitle = titleDraft.trim();
  const currentTitle = acceptedSnapshot?.title ?? work.title;
  const currentTags = acceptedSnapshot?.tags ?? work.tags;
  const currentUrls = acceptedSnapshot?.urls ?? work.urls;
  const isTitleDirty = trimmedTitle !== currentTitle;
  const isTagsDirty = !tagsEqual(tagsDraft, currentTags);
  const normalizedUrlDrafts = urlDrafts
    .map((entry) => ({ label: entry.label.trim(), url: entry.url.trim() }))
    .filter((entry) => entry.label || entry.url);
  const isUrlsDirty = !urlsEqual(normalizedUrlDrafts, currentUrls);
  const isDirty = isTitleDirty || isTagsDirty || isUrlsDirty;

  // タグのdraft操作（追加・削除・保護タグ確認・undo）。undoableTag/confirmingRemoveTagは
  // ここ（ダイアログ側）で保持し、保存開始時にundo導線を無効化できるようにする
  // （keyでの再マウントはdraft自体まで捨ててしまうため避ける）。
  const {
    addTag,
    requestRemoveTag,
    confirmingRemoveTag,
    confirmRemoveTag,
    cancelRemoveTag,
    undoableTag,
    undoRemoveTag,
    dismissUndo,
  } = useWorkEditTagsDraft({ tags: tagsDraft, onChange: setTagsDraft, tagPrefixes });

  // 新しいsnapshotが届いたときの取り込み判定。React本体が推奨する「レンダー中に
  // 前回値と比較してstateを調整する」パターン（useEffectの1tick遅延を避ける。
  // WorkTagEditor.tsxのblockEpochと同型）。
  const incoming = sourceQuery.data;
  if (incoming && incoming.sourceRevision !== processedRevision) {
    setProcessedRevision(incoming.sourceRevision);
    if (!acceptedSnapshot) {
      setAcceptedSnapshot(incoming);
      setTitleDraft(incoming.title);
      setTagsDraft(incoming.tags);
      setUrlDrafts(cloneUrls(incoming.urls));
    } else {
      const { changedFields, conflictFields: nextConflicts } = reconcileWorkEditSnapshot(
        acceptedSnapshot,
        incoming,
        { title: isTitleDirty, tags: isTagsDirty, urls: isUrlsDirty },
        { title: trimmedTitle, tags: tagsDraft, urls: normalizedUrlDrafts },
      );
      if (nextConflicts.length === 0) {
        setAcceptedSnapshot(incoming);
        if (changedFields.includes("title")) setTitleDraft(incoming.title);
        if (changedFields.includes("tags")) setTagsDraft(incoming.tags);
        if (changedFields.includes("urls")) setUrlDrafts(cloneUrls(incoming.urls));
      } else {
        setPendingSnapshot(incoming);
        setPendingChangedFields(changedFields);
        setConflictFields(nextConflicts);
        setKeepMineFields(new Set());
      }
    }
  }

  const sourceErrorMessage = sourceQuery.error
    ? sourceMutationErrorMessage(sourceQuery.error, "作品情報を読み込めないため編集できません。")
    : null;
  const canEditSource = Boolean(acceptedSnapshot) && !sourceQuery.isError;
  const hasUnresolvedConflicts = conflictFields.length > 0;

  function applyFieldToDraft(field: WorkEditField, snapshot: WorkEditSnapshot) {
    if (field === "title") setTitleDraft(snapshot.title);
    else if (field === "tags") setTagsDraft(snapshot.tags);
    else setUrlDrafts(cloneUrls(snapshot.urls));
  }

  function resolveConflictField(field: WorkEditField, useLatest: boolean) {
    if (!pendingSnapshot) return;
    if (useLatest) applyFieldToDraft(field, pendingSnapshot);
    const nextKeepMine = useLatest ? keepMineFields : new Set(keepMineFields).add(field);
    const remaining = conflictFields.filter((f) => f !== field);
    if (remaining.length === 0) {
      for (const changedField of pendingChangedFields) {
        if (!nextKeepMine.has(changedField)) applyFieldToDraft(changedField, pendingSnapshot);
      }
      setAcceptedSnapshot(pendingSnapshot);
      setPendingSnapshot(null);
      setPendingChangedFields([]);
      setConflictFields([]);
      setKeepMineFields(new Set());
    } else {
      setConflictFields(remaining);
      setKeepMineFields(nextKeepMine);
    }
  }

  function commitSavedSnapshot(snapshot: WorkEditSnapshot) {
    setAcceptedSnapshot(snapshot);
    setProcessedRevision(snapshot.sourceRevision);
    setTitleDraft(snapshot.title);
    setTagsDraft(snapshot.tags);
    setUrlDrafts(cloneUrls(snapshot.urls));
    setUrlValidationError(null);
  }

  function handleSaveError(cause: unknown) {
    if (cause instanceof ApiRequestError && cause.code === "source_changed") {
      setSaveError(SOURCE_CHANGED_MESSAGE);
      void sourceQuery.refetch().finally(() => {
        setSaveError((current) => (current === SOURCE_CHANGED_MESSAGE ? null : current));
      });
      return;
    }
    // ApiTransportError（通信断・中断）は他の失敗と区別し、成功とも失敗とも推測しない
    // 「結果を確認できませんでした」文言を出す（sourceMutationErrorMessage）。
    // draftはどちらの場合も保持する（この関数はdraftを一切書き換えない）。
    setSaveError(sourceMutationErrorMessage(cause, "保存できませんでした。"));
  }

  /** dirtyなフィールドだけを1回のPATCHへ含める（ADR-0025）。成功後は保存した値を
   *  基準へ反映し、closeAfterSaveならダイアログを閉じる。 */
  const save = async (options: { closeAfterSave: boolean }): Promise<boolean> => {
    // 送信開始時点でタグのundo導線を無効化する（保存後に別コマンドで戻す形は採らないため、
    // 保存を試みた時点で「取り消せる」という前提自体が崩れる）。
    dismissUndo();
    if (!acceptedSnapshot || hasUnresolvedConflicts) return false;
    if (isTitleDirty && !trimmedTitle) return false;
    const filledUrls = isUrlsDirty ? buildFilledUrls(urlDrafts, setUrlValidationError) : null;
    if (isUrlsDirty && filledUrls === null) return false;
    if (!isDirty) return false;

    try {
      const result = await editMutation.mutateAsync({
        workId: work.id,
        sourceRevision: acceptedSnapshot.sourceRevision,
        title: isTitleDirty ? trimmedTitle : undefined,
        tags: isTagsDirty ? tagsDraft : undefined,
        urls: isUrlsDirty && filledUrls ? filledUrls : undefined,
      });
      const outcome = interpretWorkEditSaveResult(result);
      // source確定はここで完了。catalog反映（projection）がpendingでも保存成功として扱い、
      // draftを解除する。反映状況はSourceProjectionNoticeへ委ねる。
      commitSavedSnapshot(outcome.snapshot);
      setProjection(outcome.projection);
      setSaveError(null);
      if (options.closeAfterSave) onClose();
      return true;
    } catch (cause) {
      handleSaveError(cause);
      return false;
    }
  };

  // 保存中はdisabledでフォーカスがbodyへ落ちるため、失敗確定時にフォーカスを戻す
  // （dirtyなフィールドのうち先に見つかったもの優先。titleが最優先）。
  useEffect(() => {
    if (!saveError) return;
    if (isTitleDirty) titleInputRef.current?.focus();
    else if (isUrlsDirty) firstUrlInputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- saveErrorが立った瞬間だけ発火させる
  }, [saveError]);

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

  const discardAndClose = () => {
    setIsUnsavedPromptOpen(false);
    onClose();
  };

  const saveAndClose = async () => {
    const ok = await save({ closeAfterSave: true });
    if (!ok) setIsUnsavedPromptOpen(false);
  };

  const handleSaveClick = () => {
    void save({ closeAfterSave: false });
  };

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
            <WorkSourcePatchBlockedNotice message={sourceErrorMessage} />
            {saveError && (
              <p className="mle-prv__edit-error" role="alert">
                {saveError}
              </p>
            )}
            <SourceProjectionNotice
              projection={projection}
              path={
                acceptedSnapshot && rootFolder
                  ? projectionWorkspacePath(acceptedSnapshot, rootFolder)
                  : null
              }
              onProjected={(result) => {
                queryClient.setQueryData(WORK_QUERY_KEYS.source(work.id), result.snapshot);
                setProjection(result.projection);
              }}
            />
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="work-title-input"
                  className="font-sans text-label font-semibold text-ink-1"
                >
                  タイトル
                </label>
                <TextInput
                  ref={titleInputRef}
                  id="work-title-input"
                  font="jp"
                  value={titleDraft}
                  aria-invalid={titleDraft.trim().length === 0}
                  disabled={editMutation.isPending || !canEditSource}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
                {conflictFields.includes("title") && (
                  <FieldConflictNotice
                    field="title"
                    onUseLatest={() => resolveConflictField("title", true)}
                    onKeepMine={() => resolveConflictField("title", false)}
                  />
                )}
              </div>

              <section aria-labelledby="work-edit-tags-title" className="flex flex-col gap-2">
                <h3
                  id="work-edit-tags-title"
                  className="font-sans text-label font-semibold text-ink-1"
                >
                  タグ
                </h3>
                <WorkEditTagsField
                  tags={tagsDraft}
                  tagSuggestions={tagSuggestions}
                  tagPrefixes={tagPrefixes}
                  disabled={editMutation.isPending || !canEditSource}
                  onAddTag={addTag}
                  onRequestRemoveTag={requestRemoveTag}
                  confirmingRemoveTag={confirmingRemoveTag}
                  onConfirmRemoveTag={confirmRemoveTag}
                  onCancelRemoveTag={cancelRemoveTag}
                  undoableTag={undoableTag}
                  onUndoRemoveTag={undoRemoveTag}
                  onDismissUndo={dismissUndo}
                />
                {conflictFields.includes("tags") && (
                  <FieldConflictNotice
                    field="tags"
                    onUseLatest={() => resolveConflictField("tags", true)}
                    onKeepMine={() => resolveConflictField("tags", false)}
                  />
                )}
              </section>

              <div className="flex flex-col gap-2">
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
                      disabled={editMutation.isPending || !canEditSource}
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
                      disabled={editMutation.isPending || !canEditSource}
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
                      disabled={editMutation.isPending || !canEditSource}
                      onClick={() => {
                        setUrlDrafts((prev) => prev.filter((_, i) => i !== index));
                        if (urlValidationError) setUrlValidationError(null);
                      }}
                    />
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={editMutation.isPending || !canEditSource}
                    onClick={() => setUrlDrafts((prev) => [...prev, { label: "", url: "" }])}
                  >
                    URLを追加
                  </Button>
                </div>
                {urlValidationError && (
                  <p className="mle-prv__edit-error" role="alert">
                    {urlValidationError}
                  </p>
                )}
                {conflictFields.includes("urls") && (
                  <FieldConflictNotice
                    field="urls"
                    onUseLatest={() => resolveConflictField("urls", true)}
                    onKeepMine={() => resolveConflictField("urls", false)}
                  />
                )}
              </div>
            </div>

            <div className="border-t border-line-soft pt-4">
              {acceptedSnapshot ? (
                <DlsiteEditor workId={work.id} snapshot={acceptedSnapshot} />
              ) : null}
            </div>
          </div>
          <footer className="flex shrink-0 justify-end gap-2 border-t border-line-soft px-[18px] py-3">
            <Button variant="quiet" onClick={requestClose}>
              閉じる
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={
                !canEditSource || !isDirty || hasUnresolvedConflicts || editMutation.isPending
              }
              onClick={handleSaveClick}
            >
              保存
            </Button>
          </footer>
        </div>
      </dialog>
      {isUnsavedPromptOpen && (
        <UnsavedChangesPrompt
          canSave={canEditSource && !hasUnresolvedConflicts && !(isTitleDirty && !trimmedTitle)}
          isSaving={editMutation.isPending}
          onSave={() => void saveAndClose()}
          onDiscard={discardAndClose}
          onCancel={() => setIsUnsavedPromptOpen(false)}
        />
      )}
    </>
  );
}
