import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import LibraryView from "../../src/features/library/ui/LibraryView";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { apiError, mockApi } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { defaultSmartFolderItems } from "../helpers/smartFolders";

function renderLibrary() {
  render(
    createElement(
      QueryClientProvider,
      { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
      createElement(
        JotaiProvider,
        { store: createStore() },
        createElement(
          LibraryNavigationProvider,
          null,
          createElement(LibraryView, { dockedBarActive: false }),
        ),
      ),
    ),
  );
}

describe("LibraryView: スマートフォルダー一覧の取得状態", () => {
  it("一覧が取れなかったらサイドバーと結果面に再試行を出し、再試行で一覧が出る", async () => {
    let fail = true;
    mockApi(
      appShellRoutes({
        "GET /api/smart-folders": () =>
          fail ? apiError(500, "internal", "失敗") : defaultSmartFolderItems(),
      }),
    );
    renderLibrary();

    const retries = await screen.findAllByRole("button", { name: "再試行" });
    expect(retries.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("一覧の取得に失敗しました")).toBeInTheDocument();

    fail = false;
    fireEvent.click(retries[0]!);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "ランダム" })).toBeInTheDocument(),
    );
  });

  it("一覧を待つあいだは読み込み表示を出す", () => {
    mockApi({ "GET /api/smart-folders": () => new Promise<Response>(() => {}) });
    renderLibrary();
    expect(screen.getByRole("status")).toHaveTextContent("読み込み中");
  });
});
