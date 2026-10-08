import { act, createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { beforeEach, describe, expect, it } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { mockApi, type ApiMock } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { buildScanCandidate } from "../helpers/builders";
import { seedAppMode } from "../helpers/route";

const candidate = buildScanCandidate({ path: "未登録作品", inferredTitle: "未登録作品" });

function renderTopBar(queryClient: QueryClient) {
  const store = createStore();
  seedAppMode(store, "library");

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(TopBar, {
          notificationBell: createElement("span", { "aria-label": "通知" }),
        }),
      ),
    ),
  );
}

describe("TopBar の未登録バッジ", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = mockApi(appShellRoutes({ "GET /api/scan/candidates": { candidates: [candidate] } }));
  });

  it("マウント時に /scan/candidates を取得しない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidate]);

    renderTopBar(queryClient);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "スキャン（未登録1件）" })).toBeInTheDocument();
    });
    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);
  });

  it("ウィンドウフォーカス復帰でも /scan/candidates を再取得しない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), [candidate]);

    renderTopBar(queryClient);
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "スキャン（未登録1件）" })).toBeInTheDocument();
    });
    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(api.requestsTo("GET /api/scan/candidates")).toHaveLength(0);
  });
});
