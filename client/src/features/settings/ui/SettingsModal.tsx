import { useAtomValue } from "jotai";
import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";
import {
  dlsiteBulkActiveAtom,
  dlsiteBulkProgressAtom,
  dlsiteBulkStartingAtom,
} from "../../../entities/dlsite/model/bulkAtoms";
import { useDlsiteBulkActions } from "../../../entities/dlsite/useDlsiteBulkActions";
import { scanningAtom, scanProgressLabelAtom } from "../../../entities/scan/model/atoms";
import TagPrefixSettings from "./TagPrefixSettings";
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { formatLastScanTime } from "../../../shared/lib/format";

const SECTION_CLASS = "flex flex-col gap-2";
const SECTION_LABEL_CLASS =
  "font-sans text-[10.5px] font-semibold tracking-[0.08em] text-ink-3 uppercase";
const SECTION_LABEL_NO_UPPERCASE_CLASS =
  "font-sans text-[10.5px] font-semibold tracking-[0.08em] text-ink-3";
const ROW_CLASS = "flex items-center gap-2";
const SECONDARY_BUTTON_CLASS =
  "h-[34px] cursor-pointer rounded-[6px] border border-line bg-paper-1 px-3 font-sans text-[12px] font-medium whitespace-nowrap text-ink-1";

interface SettingsModalProps {
  rootFolder: string | null;
  lastScanTime: string | null;
  onClose: () => void;
  /** TopBarのスキャンボタンと同じくスキャンモーダルを開く（即時実行はしない、TASK-56） */
  onOpenScan: () => void;
  onChangeFolder: (path: string) => void;
  onExport: () => void;
}

export default function SettingsModal({
  rootFolder,
  lastScanTime,
  onClose,
  onOpenScan,
  onChangeFolder,
  onExport,
}: SettingsModalProps) {
  const scanning = useAtomValue(scanningAtom);
  const scanProgressLabel = useAtomValue(scanProgressLabelAtom);
  const dlsiteBulkActive = useAtomValue(dlsiteBulkActiveAtom);
  const dlsiteBulkStarting = useAtomValue(dlsiteBulkStartingAtom);
  const dlsiteBulkProgress = useAtomValue(dlsiteBulkProgressAtom);
  const dlsiteBulkBusy = dlsiteBulkActive || dlsiteBulkStarting;
  const { start: onStartDlsiteBulk } = useDlsiteBulkActions();
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState(rootFolder ?? "");
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const dismiss = () => {
    if (isEditingFolder) {
      setIsEditingFolder(false);
      return;
    }
    onClose();
  };
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose: dismiss });

  useEffect(() => {
    if (isEditingFolder) folderInputRef.current?.focus({ preventScroll: true });
  }, [isEditingFolder]);

  const startEditingFolder = () => {
    setFolderDraft(rootFolder ?? "");
    setIsEditingFolder(true);
  };

  const saveFolder = () => {
    const path = folderDraft.trim();
    if (path) onChangeFolder(path);
    setIsEditingFolder(false);
  };

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-label="設定"
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      className="m-auto w-[440px] max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)] overflow-hidden rounded-[12px] border border-line-soft bg-paper-1 p-0 font-jp text-ink-0 shadow-pop backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
    >
      {/* Header */}
      <div className="flex items-center border-b border-line-soft px-[18px] py-[14px]">
        <span className="flex-1 font-sans text-[14px] font-semibold text-ink-0">設定</span>
        <button
          type="button"
          aria-label="閉じる"
          onClick={dismiss}
          className="grid h-[26px] w-[26px] cursor-pointer place-items-center rounded-[6px] border-none bg-transparent text-ink-2"
        >
          <I.x size={14} />
        </button>
      </div>

      {/* Body */}
      <div className="flex max-h-[min(72vh,640px)] flex-col gap-[18px] overflow-y-auto px-[18px] pt-[18px] pb-2">
        {/* Root folder */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_CLASS}>ルートフォルダー</span>
          {isEditingFolder ? (
            <form
              className={ROW_CLASS}
              onSubmit={(e) => {
                e.preventDefault();
                saveFolder();
              }}
            >
              <input
                ref={folderInputRef}
                value={folderDraft}
                onChange={(e) => setFolderDraft(e.target.value)}
                aria-label="ルートフォルダーのパス"
                placeholder="ルートフォルダーのパスを入力"
                className="h-[34px] flex-1 rounded-[6px] border border-acc bg-paper-0 px-3 font-mono text-[11px] text-ink-1 outline-none"
              />
              <button
                type="button"
                onClick={() => setIsEditingFolder(false)}
                className={SECONDARY_BUTTON_CLASS}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!folderDraft.trim()}
                className="h-[34px] cursor-pointer rounded-[6px] border-none bg-ink-0 px-3 font-sans text-[12px] font-semibold whitespace-nowrap text-paper-1 disabled:cursor-not-allowed disabled:opacity-60"
              >
                保存
              </button>
            </form>
          ) : (
            <div className={ROW_CLASS}>
              <div className="flex h-[34px] flex-1 items-center gap-2 overflow-hidden rounded-[6px] border border-line-soft bg-paper-0 px-3">
                <I.folder size={13} className="shrink-0 text-ink-3" />
                <span
                  className={`mll-selectable overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[11px] ${rootFolder ? "text-ink-1" : "text-ink-4"}`}
                >
                  {rootFolder ?? "未設定"}
                </span>
              </div>
              <button onClick={startEditingFolder} className={SECONDARY_BUTTON_CLASS}>
                変更
              </button>
            </div>
          )}
        </div>

        {/* Scan */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_CLASS}>スキャン</span>
          <div className={ROW_CLASS}>
            <span className="flex-1 font-mono text-[11px] text-ink-2">
              最終スキャン: {formatLastScanTime(lastScanTime)}
            </span>
            <button
              onClick={onOpenScan}
              className="flex h-[34px] cursor-pointer items-center gap-1.5 rounded-[6px] border-none bg-ink-0 px-3.5 font-sans text-[12px] font-semibold text-paper-1"
            >
              <I.refresh size={12} className={scanning ? "animate-spin" : undefined} />
              {scanning ? (scanProgressLabel ?? "スキャン中...") : "スキャン"}
            </button>
          </div>
        </div>

        {/* Tag prefixes（ADR-0005） */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_NO_UPPERCASE_CLASS}>DLSITE連携</span>
          <button
            type="button"
            disabled={dlsiteBulkBusy}
            onClick={() => void onStartDlsiteBulk()}
            className="h-[34px] cursor-pointer self-start rounded-[6px] border border-line bg-paper-1 px-3.5 font-sans text-[12px] text-ink-1 disabled:cursor-not-allowed"
          >
            {dlsiteBulkActive
              ? `取得中${dlsiteBulkProgress ? ` (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})` : "..."}`
              : "未連携をまとめて取得"}
          </button>
        </div>

        {/* Tag prefixes（ADR-0005） */}
        <TagPrefixSettings />

        {/* Export */}
        <div className={SECTION_CLASS}>
          <span className={SECTION_LABEL_CLASS}>データ</span>
          <button
            onClick={onExport}
            className="flex h-[34px] cursor-pointer items-center gap-1.5 self-start rounded-[6px] border border-line bg-paper-1 px-3.5 font-sans text-[12px] font-medium text-ink-1"
          >
            <I.download size={12} /> ライブラリをエクスポート
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end px-[18px] pt-3 pb-4">
        <button
          onClick={onClose}
          className="h-8 cursor-pointer rounded-[6px] border-none bg-paper-2 px-4 font-sans text-[12px] font-medium text-ink-1"
        >
          閉じる
        </button>
      </div>
    </dialog>
  );
}
