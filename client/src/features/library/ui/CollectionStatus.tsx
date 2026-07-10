import type { ReactNode } from "react";

// リスト（ContentColumn）とグリッド（WorkGrid）で読み込み中・エラー・0件の表示を共通化する。
// 見た目（DOM構造・クラス／インラインスタイル）は各表示の既存実装をそのまま踏襲し、
// 挙動（メッセージ選定）だけを一箇所に集約する。

type CollectionStatusKind = "loading" | "error" | "empty";

interface CollectionStatusProps {
  variant: "list" | "grid";
  kind: CollectionStatusKind;
  /** kind: "empty" のときの案内文。loading/error は固定文言を使う */
  message?: string;
  action?: ReactNode;
}

const FIXED_MESSAGE: Record<"loading" | "error", string> = {
  loading: "読み込み中...",
  error: "読み込みに失敗しました",
};

export default function CollectionStatus({
  variant,
  kind,
  message,
  action,
}: CollectionStatusProps) {
  const text = kind === "empty" ? (message ?? "") : FIXED_MESSAGE[kind];

  const content = (
    <>
      <span>{text}</span>
      {action}
    </>
  );

  if (variant === "grid") {
    return <div className="mll-grid-empty">{content}</div>;
  }

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        padding: "24px 16px",
        color: "var(--ink-4)",
        fontSize: 12,
        textAlign: "center",
      }}
    >
      {content}
    </div>
  );
}
