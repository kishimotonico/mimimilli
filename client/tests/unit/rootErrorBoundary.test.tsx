import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import RootErrorBoundary from "../../src/app/RootErrorBoundary";
import { useRootFolder } from "../../src/entities/settings/useSettingsQuery";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";

function ThrowingChild({ message }: { message: string }) {
  throw new Error(message);
}

/** 通常画面のコンポーネントが useRootFolder() を呼ぶ状況を模す */
function RootFolderReader() {
  const rootFolder = useRootFolder();
  return <div>{rootFolder}</div>;
}

function renderWithMissingRootFolder() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
    rootFolder: null,
    lastScanTime: null,
    lastScanRootFolder: null,
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <RootErrorBoundary>
        <RootFolderReader />
      </RootErrorBoundary>
    </QueryClientProvider>,
  );
}

describe("RootErrorBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("子が正常なときはそのまま描画する", () => {
    render(
      <RootErrorBoundary>
        <div>正常な子</div>
      </RootErrorBoundary>,
    );

    expect(screen.getByText("正常な子")).toBeInTheDocument();
  });

  it("子が例外を投げたときはエラー表示を出す", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowingChild message="テスト用のレンダリングエラー" />
      </RootErrorBoundary>,
    );

    expect(
      screen.getByRole("heading", { name: "表示中にエラーが発生しました" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("テスト用のレンダリングエラー");
    expect(screen.getByRole("button", { name: "再読み込み" })).toBeInTheDocument();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("技術的な詳細を展開するとスタックトレースが読める", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <RootErrorBoundary>
        <ThrowingChild message="スタック確認用エラー" />
      </RootErrorBoundary>,
    );

    fireEvent.click(screen.getByText("技術的な詳細"));
    expect(screen.getByText(/at ThrowingChild/)).toBeInTheDocument();

    consoleError.mockRestore();
  });

  it("起動ゲートの不変条件が崩れrootFolderが無いときは起動状態の不整合として表示する", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    renderWithMissingRootFolder();

    expect(
      screen.getByRole("heading", { name: "表示中にエラーが発生しました" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "ルートフォルダーが未設定です。アプリを再起動してください。",
    );
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
