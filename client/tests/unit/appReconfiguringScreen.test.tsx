import { createElement, useMemo } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import type { Settings } from "@mimimilli/shared";

function renderAppWithSettings(settings: Settings) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), settings);

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
    vi.fn(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    ),
  );
});

describe("root再設定中の画面", () => {
  it("running中はRootReconfigurationScreenのみが描画され、通常UI（LeftNav等）は出ない", async () => {
    renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: {
        status: "running",
        rootFolder: "/audio/library",
        progress: { phase: "walking", processed: 1, total: 10 },
      },
    });

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("failed中はRootReconfigurationScreenが失敗表示で出て、通常UIは出ない", async () => {
    renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: {
        status: "failed",
        rootFolder: "/audio/library",
        message: "ルートフォルダーにアクセスできません",
      },
    });

    await waitFor(() =>
      expect(screen.getByText("ライブラリの再構築に失敗しました")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("idleでrootFolder設定済みなら通常UI（Library）が描画される", async () => {
    renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle" },
    });

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByText("ライブラリを再構築しています")).not.toBeInTheDocument();
  });
});
