import { useEffect, useRef, useState } from "react";
import { I } from "../../../shared/ui/Icon";

interface SettingsModalProps {
  rootFolder: string | null;
  lastScanTime: string | null;
  scanning: boolean;
  /** scanning 中の進捗ラベル（例: "作品を登録中 (3/12)"）。TASK-20: SSEで受信した進捗 */
  scanProgressLabel?: string | null;
  onClose: () => void;
  onScan: () => void;
  onChangeFolder: (path: string) => void;
  onExport: () => void;
}

export default function SettingsModal({
  rootFolder,
  lastScanTime,
  scanning,
  scanProgressLabel = null,
  onClose,
  onScan,
  onChangeFolder,
  onExport,
}: SettingsModalProps) {
  const [isEditingFolder, setIsEditingFolder] = useState(false);
  const [folderDraft, setFolderDraft] = useState(rootFolder ?? "");
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isEditingFolder) {
          setIsEditingFolder(false);
          return;
        }
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditingFolder, onClose]);

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

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("ja-JP") : "未実行";

  return (
    <>
      {/* Backdrop */}
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Backdrop click closes the modal; Escape handling is registered above. */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "oklch(20% 0.020 70 / 0.3)" }}
        onClick={onClose}
      />
      {/* Panel */}
      <div
        style={{
          position: "fixed",
          zIndex: 41,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 440,
          background: "var(--paper-1)",
          borderRadius: 12,
          boxShadow: "var(--shadow-pop)",
          border: "1px solid var(--line-soft)",
          overflow: "hidden",
          fontFamily: "var(--font-jp)",
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
            onClick={onClose}
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
          style={{ padding: "18px 18px 8px", display: "flex", flexDirection: "column", gap: 18 }}
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
                最終スキャン: {formatDate(lastScanTime)}
              </span>
              <button
                onClick={onScan}
                disabled={scanning}
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
                  cursor: scanning ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  opacity: scanning ? 0.6 : 1,
                }}
              >
                <I.refresh size={12} className={scanning ? "animate-spin" : undefined} />
                {scanning ? (scanProgressLabel ?? "スキャン中...") : "フルスキャン"}
              </button>
            </div>
          </div>

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
      </div>
    </>
  );
}
