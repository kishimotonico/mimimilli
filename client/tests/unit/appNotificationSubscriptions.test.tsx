import { act, createElement, useMemo, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import NotificationBell from "../../src/app/ui/NotificationBell";
import { getDlsiteNotificationSummary } from "../../src/entities/work/api";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { useDlsiteNotificationSummary } from "../../src/features/library/model/useDlsiteNotificationSummary";

vi.mock("../../src/entities/work/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/entities/work/api")>();
  return {
    ...actual,
    getDlsiteNotificationSummary: vi.fn(async () => ({
      rjCodeMissingCount: 0,
      fetchFailedCount: 0,
      parseErrorCount: 0,
      parseErrorAlert: false,
      unlinkedCount: 0,
    })),
  };
});

const summaryDefaults = {
  rjCodeMissingCount: 0,
  fetchFailedCount: 0,
  parseErrorCount: 0,
  parseErrorAlert: false,
  unlinkedCount: 0,
};

let appRenderCount = 0;
let bellRenderCount = 0;

function AppShellLike({ children }: { children: ReactNode }) {
  appRenderCount += 1;
  return children;
}

function AppLikeRoot() {
  return (
    <AppShellLike>
      <NotificationBell
        dlsiteBulkActive={false}
        dlsiteBulkProgress={null}
        onStartDlsiteBulk={() => {}}
        scanResult={null}
        onOpenScanResult={() => {}}
      />
    </AppShellLike>
  );
}

function BellLike() {
  bellRenderCount += 1;
  const summary = useDlsiteNotificationSummary();
  void summary.rjCodeMissingCount;
  return null;
}

function renderHarness(children: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const store = createStore();

  function Wrapper({ children: inner }: { children: ReactNode }) {
    const client = useMemo(() => queryClient, []);
    const jotaiStore = useMemo(() => store, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(JotaiProvider, { store: jotaiStore }, inner),
    );
  }

  return { queryClient, ...render(createElement(Wrapper, null, children)) };
}

beforeEach(() => {
  appRenderCount = 0;
  bellRenderCount = 0;
  vi.mocked(getDlsiteNotificationSummary).mockResolvedValue(summaryDefaults);
});

afterEach(() => {
  vi.mocked(getDlsiteNotificationSummary).mockReset();
});

describe("App notification subscriptions", () => {
  it("summary query の更新で App 相当のルートが再レンダリングされない", async () => {
    const { queryClient } = renderHarness(createElement(AppLikeRoot));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.dlsiteNotificationSummary())?.status).toBe(
        "success",
      ),
    );
    const before = appRenderCount;

    await act(async () => {
      queryClient.setQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary(), {
        ...summaryDefaults,
        rjCodeMissingCount: 5,
      });
    });

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "通知（要対応5件）" })).toBeInTheDocument(),
    );
    expect(appRenderCount).toBe(before);
  });

  it("summary query の更新で NotificationBell 相当の購読コンポーネントは再レンダリングされる", async () => {
    const { queryClient } = renderHarness(createElement(BellLike));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.dlsiteNotificationSummary())?.status).toBe(
        "success",
      ),
    );
    const before = bellRenderCount;

    await act(async () => {
      queryClient.setQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary(), {
        ...summaryDefaults,
        fetchFailedCount: 2,
      });
    });

    await waitFor(() => expect(bellRenderCount).toBeGreaterThan(before));
  });

  it("App が useDlsiteNotificationSummary を購読していると再レンダリングされる（陽性対照）", async () => {
    function SubscribingAppShellLike({ children }: { children: ReactNode }) {
      appRenderCount += 1;
      const summary = useDlsiteNotificationSummary();
      void summary.rjCodeMissingCount;
      return children;
    }

    function SubscribingAppLikeRoot() {
      return (
        <SubscribingAppShellLike>
          <NotificationBell
            dlsiteBulkActive={false}
            dlsiteBulkProgress={null}
            onStartDlsiteBulk={() => {}}
            scanResult={null}
            onOpenScanResult={() => {}}
          />
        </SubscribingAppShellLike>
      );
    }

    const { queryClient } = renderHarness(createElement(SubscribingAppLikeRoot));
    await waitFor(() =>
      expect(queryClient.getQueryState(WORK_QUERY_KEYS.dlsiteNotificationSummary())?.status).toBe(
        "success",
      ),
    );
    const before = appRenderCount;

    await act(async () => {
      queryClient.setQueryData(WORK_QUERY_KEYS.dlsiteNotificationSummary(), {
        ...summaryDefaults,
        rjCodeMissingCount: 3,
      });
    });

    await waitFor(() => expect(appRenderCount).toBeGreaterThan(before));
  });
});
