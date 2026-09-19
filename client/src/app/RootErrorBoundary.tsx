import { Component, type ErrorInfo, type ReactNode } from "react";
import Button from "../shared/ui/Button";
import { formatUserError } from "../shared/lib/formatUserError";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
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
      const { message, detail } = formatUserError(error, "予期しないエラーが発生しました");
      return (
        <div className="flex h-screen w-full items-center justify-center bg-paper-0">
          <div className="flex max-w-md flex-col items-center gap-4 px-6 font-jp">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-[9px] bg-ink-0 font-sans text-[20px] font-semibold tracking-[-0.04em] text-paper-1">
                m
              </div>
              <span className="font-sans text-2xl font-medium tracking-[-0.01em]">mimimilli</span>
            </div>
            <h1 className="text-center text-[15px] font-medium text-ink-0">
              表示中にエラーが発生しました
            </h1>
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
