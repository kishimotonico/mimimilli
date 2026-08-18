import { act, createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { appModeAtom } from "../../src/features/navigation/model/navigationAtoms";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";

const candidate = {
  path: "未登録作品" as const,
  inferredTitle: "未登録作品",
  audioFileCount: 1,
  audioBreakdown: [{ extension: "wav", count: 1 }],
  rjCode: null,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: status === 204 ? undefined : { "Content-Type": "application/json" },
  });
}

function scanCandidatesFetchCalls(fetchMock: ReturnType<typeof vi.fn>): unknown[][] {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/scan/candidates"));
}

function renderTopBar(queryClient: QueryClient) {
  const store = createStore();
  store.set(appModeAtom, "library");

  render(
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(TopBar, {
          onOpenScan: vi.fn(),
          onSettings: vi.fn(),
          notificationBell: createElement("span", { "aria-label": "通知" }),
        }),
      ),
    ),
  );
}

describe("TopBar の未登録バッジ", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/scan/last")) return jsonResponse(null, 204);
      if (String(input).includes("/scan/candidates")) {
        return jsonResponse({ candidates: [candidate] });
      }
      return jsonResponse(null, 204);
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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
    expect(scanCandidatesFetchCalls(fetchMock)).toHaveLength(0);
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
    expect(scanCandidatesFetchCalls(fetchMock)).toHaveLength(0);

    await act(async () => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });

    expect(scanCandidatesFetchCalls(fetchMock)).toHaveLength(0);
  });

  it("前回スキャン結果から件数を導出する", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/scan/last")) {
        return jsonResponse({
          finishedAt: "2026-01-01T00:00:00.000Z",
          result: {
            registered: 0,
            insertedWorkIds: [],
            updatedWorkIds: [],
            errors: 0,
            missing: 0,
            rjCodeMissingCount: 0,
            skipped: 0,
            coverErrors: 0,
            identityConflicts: [],
            invalidMetaFiles: [],
            candidates: [candidate, { ...candidate, path: "もう1件", inferredTitle: "もう1件" }],
          },
        });
      }
      if (String(input).includes("/scan/candidates")) {
        return jsonResponse({ candidates: [candidate] });
      }
      return jsonResponse(null, 204);
    });

    renderTopBar(queryClient);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "スキャン（未登録2件）" })).toBeInTheDocument();
    });
    expect(scanCandidatesFetchCalls(fetchMock)).toHaveLength(0);
  });
});
