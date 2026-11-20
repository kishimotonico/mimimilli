import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";
import Button from "../../../shared/ui/Button";
import TextInput from "../../../shared/ui/TextInput";
import { useRootFolder } from "../../../entities/settings/useSettingsQuery";
import TagPrefixSettings from "./TagPrefixSettings";
import ExcludedFoldersSettings from "./ExcludedFoldersSettings";
import Modal, { ModalHeader } from "../../../shared/ui/Modal";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { apiErrorMessage } from "../../../shared/lib/apiError";

const SECTION_CLASS = "flex flex-col gap-2";
const SECTION_LABEL_CLASS =
  "font-sans text-label font-semibold tracking-[0.08em] text-ink-2 uppercase";
const ROW_CLASS = "flex items-center gap-2";

interface SettingsModalProps {
  onClose: () => void;
  /** 失敗時はrejectする。成功を待ってから編集フォームを閉じる */
  onChangeFolder: (path: string) => Promise<unknown>;
  onExport: () => void;
}

export default function SettingsModal({ onClose, onChangeFolder, onExport }: SettingsModalProps) {
  const rootFolder = useRootFolder();
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState(rootFolder);
  const [savingFolder, setSavingFolder] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const dismiss = () => {
    if (isEditingFolder) {
      if (savingFolder) return;
      setIsEditingFolder(false);
      return;
    }
    onClose();
  };
  const dialog = useDialogModal({ onClose: dismiss });

  useEffect(() => {
    if (isEditingFolder) folderInputRef.current?.focus({ preventScroll: true });
  }, [isEditingFolder]);

  const startEditingFolder = () => {
    setFolderDraft(rootFolder);
    setFolderError(null);
    setIsEditingFolder(true);
  };

  const saveFolder = async () => {
    const path = folderDraft.trim();
    if (!path || savingFolder) return;
    setSavingFolder(true);
    setFolderError(null);
    try {
      await onChangeFolder(path);
      setIsEditingFolder(false);
    } catch (error) {
      setFolderError(apiErrorMessage(error, "ルートフォルダーを変更できませんでした"));
    } finally {
      setSavingFolder(false);
    }
  };

  return (
    <Modal dialog={dialog} size={440} labelledBy="settings-title">
      <ModalHeader title="設定" titleId="settings-title" onClose={dismiss} />

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] pt-[18px] pb-2">
        {/* Root folder */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_CLASS}>ルートフォルダー</span>
          {isEditingFolder ? (
            <>
              <form
                className={ROW_CLASS}
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveFolder();
                }}
              >
                <TextInput
                  font="mono"
                  ref={folderInputRef}
                  value={folderDraft}
                  onChange={(e) => setFolderDraft(e.target.value)}
                  aria-label="ルートフォルダーのパス"
                  placeholder="ルートフォルダーのパスを入力"
                  disabled={savingFolder}
                  className="h-[34px] flex-1 border-acc px-3 text-ink-1 focus-visible:border-acc disabled:opacity-60"
                />
                <Button
                  variant="quiet"
                  size="md"
                  disabled={savingFolder}
                  onClick={() => setIsEditingFolder(false)}
                >
                  キャンセル
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  type="submit"
                  disabled={!folderDraft.trim() || savingFolder}
                >
                  {savingFolder ? "保存中..." : "保存"}
                </Button>
              </form>
              <output className="m-0 block rounded-[6px] bg-paper-2 px-2.5 py-2 font-jp text-secondary text-ink-2">
                変更すると再設定が始まり、完了までLibrary・Filesが使えなくなります。作品の履歴（ブックマーク・再生位置など）には影響しません。
              </output>
              {folderError && (
                <p role="alert" className="mll-selectable m-0 text-secondary text-[var(--r-coral)]">
                  {folderError}
                </p>
              )}
            </>
          ) : (
            <div className={ROW_CLASS}>
              <div className="flex h-[34px] flex-1 items-center gap-2 overflow-hidden rounded-[6px] border border-line-soft bg-paper-0 px-3">
                <I.folder size={13} className="shrink-0 text-ink-3" />
                <span className="mll-selectable overflow-hidden text-ellipsis whitespace-nowrap font-mono text-mono text-ink-1">
                  {rootFolder}
                </span>
              </div>
              <Button variant="ghost" size="md" onClick={startEditingFolder}>
                変更
              </Button>
            </div>
          )}
        </div>

        {/* 候補から外したフォルダー */}
        <ExcludedFoldersSettings />

        {/* Tag prefixes（ADR-0005） */}
        <TagPrefixSettings />

        {/* Export */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_CLASS}>データ</span>
          <Button
            variant="ghost"
            size="md"
            icon={I.download}
            className="self-start"
            onClick={onExport}
          >
            ライブラリをエクスポート
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex shrink-0 justify-end px-[18px] pt-3 pb-4">
        <Button variant="ghost" size="md" onClick={dismiss}>
          閉じる
        </Button>
      </div>
    </Modal>
  );
}
