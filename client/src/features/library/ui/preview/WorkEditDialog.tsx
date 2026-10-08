import { useRef } from "react";
import type { Work } from "@mimimilli/shared";
import Button from "../../../../shared/ui/Button";
import TextInput from "../../../../shared/ui/TextInput";
import Modal, { ModalFooter, ModalHeader } from "../../../../shared/ui/Modal";
import { useDialogModal } from "../../../../shared/ui/useDialogModal";
import type { useLibraryWorkPatchMutations } from "../../model/useLibraryQueries";
import { projectionWorkspacePath } from "../../../../entities/work/sourceMutation";
import { SourceProjectionNotice } from "../../../../entities/work/ui/SourceProjectionNotice";
import { useRootFolderOrNull } from "../../../../entities/settings/useSettingsQuery";
import { useTagPrefixes } from "../../../../entities/tag/useTagPrefixes";
import type { WorkEditField } from "../../model/workEditReconcile";
import { WorkSourcePatchBlockedNotice } from "./WorkSourcePatchBlockedNotice";
import { DlsiteEditor } from "./DlsiteEditor";
import { WorkEditTagsField } from "./WorkEditTagsField";
import { WorkEditUrlsField } from "./WorkEditUrlsField";
import { useWorkEditDraft } from "./useWorkEditDraft";

interface WorkEditDialogProps {
  work: Work;
  tagSuggestions: string[];
  workPatchMutations: Pick<ReturnType<typeof useLibraryWorkPatchMutations>, "editMutation">;
  onClose: () => void;
}

const FIELD_LABEL: Record<WorkEditField, string> = {
  title: "タイトル",
  tags: "タグ",
  urls: "関連URL",
};

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
  const dialog = useDialogModal({
    onClose: onCancel,
    initialFocusRef: cancelRef,
  });

  return (
    <Modal dialog={dialog} size="alert" label="未保存の変更があります">
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
    </Modal>
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
  const { tagPrefixes } = useTagPrefixes();
  const rootFolder = useRootFolderOrNull();
  const edit = useWorkEditDraft({ work, editMutation, tagPrefixes, onClose });

  const dialog = useDialogModal({
    onClose: edit.requestClose,
    initialFocusRef: edit.titleInputRef,
  });

  return (
    <>
      <Modal dialog={dialog} size={640} labelledBy="work-edit-title">
        <ModalHeader title="作品を編集" titleId="work-edit-title" onClose={edit.requestClose} />
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-[18px] py-4">
          <WorkSourcePatchBlockedNotice message={edit.sourceErrorMessage} />
          {edit.saveError && (
            <p className="mle-prv__edit-error" role="alert">
              {edit.saveError}
            </p>
          )}
          <SourceProjectionNotice
            projection={edit.projection}
            path={
              edit.acceptedSnapshot && rootFolder
                ? projectionWorkspacePath(edit.acceptedSnapshot, rootFolder)
                : null
            }
            onProjected={edit.applyProjectedResult}
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
                ref={edit.titleInputRef}
                id="work-title-input"
                font="jp"
                value={edit.title}
                aria-invalid={edit.title.trim().length === 0}
                disabled={edit.isBusy}
                onChange={(event) => edit.setTitle(event.target.value)}
              />
              {edit.conflictFields.includes("title") && (
                <FieldConflictNotice
                  field="title"
                  onUseLatest={() => edit.resolveConflict("title", true)}
                  onKeepMine={() => edit.resolveConflict("title", false)}
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
                tags={edit.tags}
                tagSuggestions={tagSuggestions}
                tagPrefixes={tagPrefixes}
                disabled={edit.isBusy}
                onAddTag={edit.tagsDraft.addTag}
                onRequestRemoveTag={edit.tagsDraft.requestRemoveTag}
                confirmingRemoveTag={edit.tagsDraft.confirmingRemoveTag}
                onConfirmRemoveTag={edit.tagsDraft.confirmRemoveTag}
                onCancelRemoveTag={edit.tagsDraft.cancelRemoveTag}
                undoableTag={edit.tagsDraft.undoableTag}
                onUndoRemoveTag={edit.tagsDraft.undoRemoveTag}
                onDismissUndo={edit.tagsDraft.dismissUndo}
              />
              {edit.conflictFields.includes("tags") && (
                <FieldConflictNotice
                  field="tags"
                  onUseLatest={() => edit.resolveConflict("tags", true)}
                  onKeepMine={() => edit.resolveConflict("tags", false)}
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
              <WorkEditUrlsField
                urls={edit.urls}
                disabled={edit.isBusy}
                firstInputRef={edit.firstUrlInputRef}
                onChange={edit.setUrls}
              />
              {edit.urlValidationError && (
                <p className="mle-prv__edit-error" role="alert">
                  {edit.urlValidationError}
                </p>
              )}
              {edit.conflictFields.includes("urls") && (
                <FieldConflictNotice
                  field="urls"
                  onUseLatest={() => edit.resolveConflict("urls", true)}
                  onKeepMine={() => edit.resolveConflict("urls", false)}
                />
              )}
            </div>
          </div>

          <div className="border-t border-line-soft pt-4">
            {edit.acceptedSnapshot ? (
              <DlsiteEditor workId={work.id} snapshot={edit.acceptedSnapshot} />
            ) : null}
          </div>
        </div>
        <ModalFooter>
          <Button variant="quiet" onClick={edit.requestClose}>
            閉じる
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!edit.canSubmit}
            onClick={() => void edit.save({ closeAfterSave: false })}
          >
            保存
          </Button>
        </ModalFooter>
      </Modal>
      {edit.isUnsavedPromptOpen && (
        <UnsavedChangesPrompt
          canSave={edit.canSave}
          isSaving={edit.isSaving}
          onSave={() => void edit.saveAndClose()}
          onDiscard={edit.discardAndClose}
          onCancel={edit.cancelUnsavedPrompt}
        />
      )}
    </>
  );
}
