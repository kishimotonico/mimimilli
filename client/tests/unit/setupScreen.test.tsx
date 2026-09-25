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
import * as settingsApi from "../../src/entities/settings/api";
import { ApiRequestError } from "../../src/shared/api/http";

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
    rootReconfiguration: { status: "idle" },
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

  it("パス送信で startRootReconfiguration を呼び、成功後は settings を再取得する", async () => {
    const startRootReconfiguration = vi
      .spyOn(settingsApi, "startRootReconfiguration")
      .mockResolvedValue({
        status: "running",
        rootFolder: "/audio/library",
        progress: null,
      });

    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Users\/yourname/);
    fireEvent.change(input, { target: { value: "/audio/library" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() => expect(startRootReconfiguration).toHaveBeenCalledWith("/audio/library"));
    // 成功後は settings を再取得する（staleTime=Infinityの初期データが無効化され、再フェッチが走る）
    await waitFor(() =>
      expect(fetch as unknown as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        expect.stringContaining("/settings"),
      ),
    );
  });

  it("送信が失敗したらエラーを表示する", async () => {
    vi.spyOn(settingsApi, "startRootReconfiguration").mockRejectedValue(
      new Error("保存に失敗しました"),
    );

    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Users\/yourname/), {
      target: { value: "/bad/path" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("保存に失敗しました"));
    expect(screen.getByText("ようこそ")).toBeInTheDocument();
  });

  it("ルートフォルダー検証エラー（InvalidRootFolderError由来のApiRequestError）はサーバーの文言をそのまま表示する", async () => {
    vi.spyOn(settingsApi, "startRootReconfiguration").mockRejectedValue(
      new ApiRequestError(
        400,
        "invalid_request",
        "指定されたルートフォルダーが存在しません: /no/such/path",
      ),
    );

    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Users\/yourname/), {
      target: { value: "/no/such/path" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "指定されたルートフォルダーが存在しません: /no/such/path",
      ),
    );
    expect(screen.queryByText("初回セットアップに失敗しました")).not.toBeInTheDocument();
  });
});
