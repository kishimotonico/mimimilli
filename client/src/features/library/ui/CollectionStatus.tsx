import type { ReactNode } from "react";
import Button from "../../../shared/ui/Button";
import { I } from "../../../shared/ui/Icon";

// リスト（ContentColumn）とグリッド（WorkGrid）で読み込み中・エラー・0件の表示を共通化する。
// 見た目（DOM構造・クラス／インラインスタイル）は各表示の既存実装をそのまま踏襲し、
// 挙動（メッセージ選定・再試行導線・状態変化の読み上げ）だけを一箇所に集約する。

type CollectionStatusKind = "loading" | "error" | "empty";

interface CollectionStatusProps {
  variant: "list" | "grid";
  kind: CollectionStatusKind;
  /** kind: "empty" のときの案内文。loading/error は固定文言を使う */
  message?: string;
  /** kind: "empty" のときの補足1行（文脈付きの説明・CTA） */
  hint?: string;
  /** kind: "empty" のとき追加で出すアクション（例: 検索をクリア） */
  action?: ReactNode;
  /** kind: "error" のとき再試行ボタンを出す。省略時はボタンなし */
  onRetry?: () => void;
}

const FIXED_MESSAGE: Record<"loading" | "error", string> = {
  loading: "読み込み中...",
  error: "読み込みに失敗しました",
};

const SKELETON_ROW_COUNT = 6;

function StatusSkeleton({ variant }: { variant: "list" | "grid" }) {
  return (
    <div className={`mll-status-skeleton is-${variant}`} aria-hidden="true">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className="mll-status-skeleton__row" />
      ))}
    </div>
  );
}

export default function CollectionStatus({
  variant,
  kind,
  message,
  hint,
  action,
  onRetry,
}: CollectionStatusProps) {
  const text = kind === "empty" ? (message ?? "") : FIXED_MESSAGE[kind];

  const content =
    kind === "loading" ? (
      <>
        <StatusSkeleton variant={variant} />
        <span className="mll-status-sr">{text}</span>
      </>
    ) : (
      <>
        <span>{text}</span>
        {kind === "empty" && hint && <span className="mll-status-hint">{hint}</span>}
        {kind === "error" && onRetry && (
          <Button variant="ghost" icon={I.refresh} onClick={onRetry}>
            再試行
          </Button>
        )}
        {action}
      </>
    );

  if (variant === "grid") {
    return (
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> はフォーム計算結果向けの意味を持つため、一覧の読み込み状態通知には role="status" を使う
      <div className="mll-grid-empty" role="status" aria-live="polite">
        {content}
      </div>
    );
  }

  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <output> はフォーム計算結果向けの意味を持つため、一覧の読み込み状態通知には role="status" を使う
      role="status"
      aria-live="polite"
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
