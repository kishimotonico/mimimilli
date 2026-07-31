import Button from "../../shared/ui/Button";

interface StartupErrorScreenProps {
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}

function formatStartupError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "設定の取得に失敗しました";
}

export default function StartupErrorScreen({
  error,
  onRetry,
  isRetrying = false,
}: StartupErrorScreenProps) {
  const message = formatStartupError(error);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-paper-0">
      <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center font-jp">
        <h1 className="text-[15px] font-medium text-ink-0">起動できませんでした</h1>
        <p className="mll-selectable text-[13px] text-ink-2" role="alert">
          {message}
        </p>
        <Button variant="primary" onClick={onRetry} disabled={isRetrying}>
          {isRetrying ? "再試行中..." : "再試行"}
        </Button>
      </div>
    </div>
  );
}
