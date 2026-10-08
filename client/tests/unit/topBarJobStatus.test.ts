import { act, createElement } from "react";
import { render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import TopBar from "../../src/app/ui/TopBar";
import { dlsiteBulkStoreAtom } from "../../src/entities/dlsite/model/dlsiteBulkStore";
import { scanJobStoreAtom } from "../../src/entities/scan/model/scanJobStore";
import { createFakeDlsiteBulkStore, createFakeScanJobStore } from "../helpers/fakeJobStores";
import { SCAN_QUERY_KEYS } from "../../src/features/scan/api";
import { seedAppMode } from "../helpers/route";

function renderTopBar(atomState?: {
  scanJob?: import("@mimimilli/shared").ScanJobSnapshot | null;
  dlsiteActive?: boolean;
  dlsiteProgress?: import("@mimimilli/shared").DlsiteBulkProgressSnapshot | null;
}) {
  const store = createStore();
  seedAppMode(store, "library");
  const scanJob = createFakeScanJobStore({ job: atomState?.scanJob ?? null });
  const dlsiteBulk = createFakeDlsiteBulkStore({
    ...(atomState?.dlsiteActive !== undefined && {
      jobId: atomState.dlsiteActive ? "job-1" : null,
    }),
    ...(atomState?.dlsiteProgress !== undefined && { progress: atomState.dlsiteProgress }),
  });
  store.set(scanJobStoreAtom, scanJob);
  store.set(dlsiteBulkStoreAtom, dlsiteBulk);

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
  return { store, scanJob, dlsiteBulk };
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

  it("DLsite 一括取得中は進捗と中止ボタンを表示する", () => {
    renderTopBar({
      dlsiteActive: true,
      dlsiteProgress: {
        processed: 2,
        total: 5,
        work: { id: "work-1", rjCode: "RJ111111", title: "夜のラジオ" },
      },
    });

    expect(screen.getByText("DLsiteから取得中 (2/5)")).toBeInTheDocument();
    expect(screen.getByText("— 夜のラジオ")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "中止" })).toBeInTheDocument();
  });

  it("ストアの更新で進捗表示が追従する", () => {
    const { dlsiteBulk } = renderTopBar({
      dlsiteActive: true,
      dlsiteProgress: {
        processed: 1,
        total: 5,
        work: { id: "work-1", rjCode: "RJ111111", title: "" },
      },
    });
    expect(screen.getByText("DLsiteから取得中 (1/5)")).toBeInTheDocument();
    expect(screen.getByText("— RJ111111")).toBeInTheDocument();

    act(() => {
      dlsiteBulk.setState((state) => ({
        ...state,
        progress: {
          processed: 4,
          total: 5,
          work: { id: "work-2", rjCode: "RJ222222", title: "朝のラジオ" },
        },
      }));
    });
    expect(screen.getByText("DLsiteから取得中 (4/5)")).toBeInTheDocument();
    expect(screen.getByText("— 朝のラジオ")).toBeInTheDocument();
  });
});
