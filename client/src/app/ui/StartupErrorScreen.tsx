import Button from "../../shared/ui/Button";
import { formatUserError } from "../../shared/lib/formatUserError";

interface StartupErrorScreenProps {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}

export default function StartupErrorScreen({
  error,
  onRetry,
  isRetrying = false,
}: StartupErrorScreenProps) {
  const { message, detail } = formatUserError(error, "設定の取得に失敗しました");

  return (
    <div className="flex h-screen w-full items-center justify-center bg-paper-0">
      <div className="flex max-w-md flex-col items-center gap-4 px-6 font-jp">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-[9px] bg-ink-0 font-sans text-[20px] font-semibold tracking-[-0.04em] text-paper-1">
            m
          </div>
          <span className="font-sans text-2xl font-medium tracking-[-0.01em]">mimimilli</span>
        </div>
        <h1 className="text-center text-[15px] font-medium text-ink-0">起動できませんでした</h1>
        <p className="mll-selectable w-full text-left text-[13px] text-ink-2" role="alert">
          {message}
        </p>
        {detail ? (
          <details className="w-full text-left">
            <summary className="cursor-pointer text-secondary text-ink-2">技術的な詳細</summary>
            <pre className="mll-selectable mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-secondary text-ink-2">
              {detail}
            </pre>
          </details>
        ) : null}
        <Button variant="primary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "再試行中..." : "再試行"}
        </Button>
      </div>
    </div>
  );
}
