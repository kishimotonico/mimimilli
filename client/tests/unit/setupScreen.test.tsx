import { act, createElement, useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import * as settingsApi from "../../src/features/settings/api";
import * as scanApi from "../../src/features/scan/api";

const runningJob = {
  id: "job-1",
  status: "running" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  startedAt: "2026-01-01T00:00:00.000Z",
  finishedAt: null,
  progress: { phase: "walking" as const, processed: 0, total: 0 },
  result: null,
  error: null,
};

function renderSetupApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
    rootFolder: null,
    lastScanTime: null,
  });

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        null,
        createElement(
          PlayerRuntimeProvider,
          null,
          createElement(DlsiteBulkRuntime),
          createElement(ScanRuntime),
          createElement(App),
        ),
      ),
    );
  }

  render(createElement(Wrapper));
  return { queryClient };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/scan/active")) {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/scan/last")) {
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/works/search") || url.includes("/works?")) {
        return new Response(JSON.stringify({ items: [], total: 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
});

describe("SetupScreen 経路", () => {
  it("rootFolder 未設定時に SetupScreen を表示する", async () => {
    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /スキャン開始/ })).toBeInTheDocument();
  });

  it("パス送信で setRootFolder とスキャン開始を呼ぶ", async () => {
    const setRootFolder = vi
      .spyOn(settingsApi, "setRootFolder")
      .mockResolvedValue({ rootFolder: "/audio/library", lastScanTime: null });
    const startScan = vi.spyOn(scanApi, "startScan").mockResolvedValue(runningJob);

    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Users\/yourname/);
    fireEvent.change(input, { target: { value: "/audio/library" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() => expect(setRootFolder).toHaveBeenCalledWith("/audio/library"));
    expect(startScan).toHaveBeenCalledTimes(1);
  });

  it("送信が失敗したらエラーを表示する", async () => {
    vi.spyOn(settingsApi, "setRootFolder").mockRejectedValue(new Error("保存に失敗しました"));

    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Users\/yourname/), {
      target: { value: "/bad/path" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("保存に失敗しました"));
  });
});
