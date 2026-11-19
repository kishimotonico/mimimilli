import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import { createFakeScanJobStore } from "../helpers/fakeJobStores";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { seedAppMode } from "../helpers/route";

function renderTopBar(atomState?: {
  scanJob?: import("@mimimilli/shared").ScanJobSnapshot | null;
}) {
  const store = createStore();
  seedAppMode(store, "library");
  const scanJob = createFakeScanJobStore({ job: atomState?.scanJob ?? null });
  store.set(scanJobStoreAtom, scanJob);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
  });
  queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), []);

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
  return { store, scanJob };
}

describe("TopBar のジョブ状態表示", () => {
  it("スキャン実行中は進捗ラベルを表示する", () => {
    renderTopBar({
      scanJob: {
        id: "job-1",
        status: "running",
        createdAt: "2026-01-01T00:00:00.000Z",
        startedAt: "2026-01-01T00:00:00.000Z",
        finishedAt: null,
        progress: { phase: "registering", processed: 3, total: 12 },
        result: null,
        error: null,
      },
    });

    expect(screen.getByText("作品を登録中 (3/12)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /作品を登録中 \(3\/12\)/ })).toBeInTheDocument();
  });
});
