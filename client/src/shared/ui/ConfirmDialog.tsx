// 破壊的操作の確認ダイアログ。保護タグの削除（ADR-0005: ソフトガード）などに使う。
// z-index は設定モーダルと同じ 40/41 の層（docs/design-system.md）。
import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    cancelRef.current?.focus({ preventScroll: true });
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onCancel]);

  return (
    <>
      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- Backdrop click cancels; Escape handling is registered above. */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 40, background: "oklch(20% 0.020 70 / 0.3)" }}
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          zIndex: 41,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 360,
          background: "var(--paper-1)",
          borderRadius: 12,
          boxShadow: "var(--shadow-pop)",
          border: "1px solid var(--line-soft)",
          padding: "18px 18px 14px",
          fontFamily: "var(--font-jp)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            fontSize: 13.5,
            color: "var(--ink-0)",
          }}
        >
          {title}
        </span>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7, color: "var(--ink-1)" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid var(--line)",
              background: "var(--paper-1)",
              color: "var(--ink-1)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--r-coral)",
              color: "var(--paper-1)",
              fontFamily: "var(--font-sans)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
