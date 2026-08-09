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
      className="backdrop:bg-[oklch(20%_0.020_70_/_0.3)]"
      style={{
        width: 440,
        maxWidth: "calc(100vw - 32px)",
        maxHeight: "calc(100vh - 32px)",
        margin: "auto",
        padding: 0,
        background: "var(--paper-1)",
        borderRadius: 12,
        boxShadow: "var(--shadow-pop)",
        border: "1px solid var(--line-soft)",
        overflow: "hidden",
        fontFamily: "var(--font-jp)",
        color: "var(--ink-0)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "14px 18px",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 14,
            color: "var(--ink-0)",
            flex: 1,
          }}
        >
          設定
        </span>
        <button
          type="button"
          aria-label="閉じる"
          onClick={dismiss}
          style={{
            width: 26,
            height: 26,
            display: "grid",
            placeItems: "center",
            borderRadius: 6,
            color: "var(--ink-2)",
            border: "none",
            background: "none",
            cursor: "pointer",
          }}
        >
          <I.x size={14} />
        </button>
      </div>

      {/* Body */}
      <div
        style={{
          padding: "18px 18px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          maxHeight: "min(72vh, 640px)",
          overflowY: "auto",
        }}
      >
        {/* Root folder */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
            }}
          >
            ルートフォルダー
          </span>
          {isEditingFolder ? (
            <form
              style={{ display: "flex", alignItems: "center", gap: 8 }}
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
                style={{
                  flex: 1,
                  height: 34,
                  padding: "0 12px",
                  background: "var(--paper-0)",
                  border: "1px solid var(--acc)",
                  borderRadius: 6,
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-1)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => setIsEditingFolder(false)}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--paper-1)",
                  color: "var(--ink-1)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={!folderDraft.trim()}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--ink-0)",
                  color: "var(--paper-1)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: folderDraft.trim() ? "pointer" : "not-allowed",
                  opacity: folderDraft.trim() ? 1 : 0.6,
                  whiteSpace: "nowrap",
                }}
              >
                保存
              </button>
            </form>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  flex: 1,
                  height: 34,
                  padding: "0 12px",
                  background: "var(--paper-0)",
                  border: "1px solid var(--line-soft)",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  overflow: "hidden",
                }}
              >
                <I.folder size={13} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
                <span
                  className="mll-selectable"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: rootFolder ? "var(--ink-1)" : "var(--ink-4)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {rootFolder ?? "未設定"}
                </span>
              </div>
              <button
                onClick={startEditingFolder}
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 6,
                  border: "1px solid var(--line)",
                  background: "var(--paper-1)",
                  color: "var(--ink-1)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                変更
              </button>
            </div>
          )}
        </div>

        {/* Scan */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
            }}
          >
            スキャン
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                flex: 1,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink-2)",
              }}
            >
              最終スキャン: {formatLastScanTime(lastScanTime)}
            </span>
            <button
              onClick={onOpenScan}
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 6,
                background: "var(--ink-0)",
                color: "var(--paper-1)",
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                fontWeight: 600,
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <I.refresh size={12} className={scanning ? "animate-spin" : undefined} />
              {scanning ? (scanProgressLabel ?? "スキャン中...") : "スキャン"}
            </button>
          </div>
        </div>

        {/* Tag prefixes（ADR-0005） */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
            }}
          >
            DLSITE連携
          </span>
          <button
            type="button"
            disabled={dlsiteBulkBusy}
            onClick={() => void onStartDlsiteBulk()}
            style={{
              alignSelf: "flex-start",
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--paper-1)",
              color: "var(--ink-1)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              cursor: dlsiteBulkBusy ? "not-allowed" : "pointer",
            }}
          >
            {dlsiteBulkActive
              ? `取得中${dlsiteBulkProgress ? ` (${dlsiteBulkProgress.processed}/${dlsiteBulkProgress.total})` : "..."}`
              : "未連携をまとめて取得"}
          </button>
        </div>

        {/* Tag prefixes（ADR-0005） */}
        <TagPrefixSettings />

        {/* Export */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--ink-3)",
              textTransform: "uppercase",
            }}
          >
            データ
          </span>
          <button
            onClick={onExport}
            style={{
              alignSelf: "flex-start",
              height: 34,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--paper-1)",
              color: "var(--ink-1)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <I.download size={12} /> ライブラリをエクスポート
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 18px 16px", display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onClose}
          style={{
            height: 32,
            padding: "0 16px",
            borderRadius: 6,
            background: "var(--paper-2)",
            color: "var(--ink-1)",
            fontFamily: "var(--font-sans)",
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
          }}
        >
          閉じる
        </button>
      </div>
    </dialog>
  );
}
