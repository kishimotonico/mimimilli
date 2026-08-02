import { Component, type ErrorInfo, type ReactNode } from "react";
import Button from "../shared/ui/Button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "予期しないエラーが発生しました";
}

export default class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("RootErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = (): void => {
    location.reload();
  };

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-paper-0">
          <div className="flex max-w-md flex-col items-center gap-4 px-6 text-center font-jp">
            <h1 className="text-[15px] font-medium text-ink-0">表示中にエラーが発生しました</h1>
            <p className="mll-selectable text-[13px] text-ink-2" role="alert">
              {formatErrorMessage(error)}
            </p>
            {error.stack ? (
              <details className="w-full text-left">
                <summary className="cursor-pointer text-[12px] text-ink-2">技術的な詳細</summary>
                <pre className="mll-selectable mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all text-left text-[11px] text-ink-3">
                  {error.stack}
                </pre>
              </details>
            ) : null}
            <Button variant="primary" onClick={this.handleReload}>
              再読み込み
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
