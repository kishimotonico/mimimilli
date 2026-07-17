// RJコード未検出（フォルダー名からDLsite作品を特定できなかった）作品の一覧。
// スキャン完了ポップアップの「確認する」、ヘッダーの通知ベルの両方から開ける（TASK-41）。
// 各行から作品詳細（DlsitePanelのRJコード入力欄）へ迷わず遷移できることが目的。
import { useDialogModal } from "../../../shared/ui/useDialogModal";
import { useRjCodeMissingWorks } from "../model/dlsiteMissingRjCode";

interface RjCodeMissingModalProps {
  onClose: () => void;
  onOpenWork: (workId: string) => void;
}

export default function RjCodeMissingModal({ onClose, onOpenWork }: RjCodeMissingModalProps) {
  const { works, isLoading } = useRjCodeMissingWorks();
  const { dialogRef, handleCancel, handleBackdropClick } = useDialogModal({ onClose });

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdropクリックで閉じる。EscapeはonCancel（useDialogModal）で処理する。
    <dialog
      ref={dialogRef}
      aria-label="RJコード未検出の作品"
      onCancel={handleCancel}
      onClick={(e) => handleBackdropClick(e, onClose)}
      className="backdrop:bg-[oklch(0%_0_0_/_0.55)]"
      style={{
        background: "var(--paper-1)",
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: 22,
        margin: "auto",
        width: 480,
        maxWidth: "min(90vw, calc(100vw - 32px))",
        maxHeight: "min(80vh, calc(100vh - 32px))",
        color: "var(--ink-0)",
        display: "flex",
        flexDirection: "column",
        fontFamily: "var(--font-jp)",
      }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 700 }}>RJコード未検出の作品</h2>
      <p style={{ margin: "0 0 14px", fontSize: 12, color: "var(--ink-2)" }}>
        フォルダー名からDLsiteのRJコードを自動検出できませんでした。作品を開いてRJコードを手入力するか、連携しない設定にできます。
      </p>

      {isLoading ? (
        <p style={{ fontSize: 12, color: "var(--ink-3)" }}>読み込み中...</p>
      ) : works.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--ink-3)" }}>RJコード未検出の作品はありません。</p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            overflowY: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {works.map((work) => (
            <li key={work.id}>
              <button
                type="button"
                onClick={() => onOpenWork(work.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 2,
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "1px solid var(--line-soft)",
                  background: "var(--paper-0)",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                  }}
                >
                  {work.title}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    color: "var(--ink-3)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    width: "100%",
                  }}
                >
                  {work.physicalPath}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        onClick={onClose}
        style={{
          marginTop: 16,
          background: "var(--acc)",
          border: "none",
          borderRadius: 6,
          color: "var(--paper-1)",
          cursor: "pointer",
          padding: "10px 28px",
          fontSize: 14,
          fontWeight: 600,
          alignSelf: "center",
        }}
      >
        閉じる
      </button>
    </dialog>
  );
}
