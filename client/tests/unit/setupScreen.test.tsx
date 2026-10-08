import { act, createElement, useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import NavigationHistorySync from "../../src/features/navigation/ui/NavigationHistorySync";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { apiError, apiNoContent, mockApi, type ApiMock } from "../helpers/api";
import { buildSettings } from "../helpers/builders";

const SETUP_SETTINGS = buildSettings({ rootFolder: null });
let api: ApiMock;
let startReply: unknown;

function renderSetupApp() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Number.POSITIVE_INFINITY },
      mutations: { retry: false },
    },
  });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), SETUP_SETTINGS);

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
          createElement(NavigationHistorySync),
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
  startReply = {
    status: "running",
    rootFolder: "/audio/library",
    progress: null,
  };
  api = mockApi({
    "GET /api/settings": SETUP_SETTINGS,
    "GET /api/scan/active": () => apiNoContent(),
    "GET /api/scan/last": () => apiNoContent(),
    "GET /api/scan/candidates": { candidates: [] },
    "POST /api/root-reconfiguration": () => startReply,
  });
});

describe("RootConfigurationScreen（初回セットアップ）経路", () => {
  it("rootFolder 未設定時に初回セットアップ画面を表示する", async () => {
    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /スキャン開始/ })).toBeInTheDocument();
  });

  it("パス送信でroot再設定を開始し、成功後は settings を再取得する", async () => {
    renderSetupApp();
    await waitFor(() => expect(screen.getByText("ようこそ")).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Users\/yourname/);
    fireEvent.change(input, { target: { value: "/audio/library" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /スキャン開始/ }));
    });

    await waitFor(() =>
      expect(api.requestsTo("POST /api/root-reconfiguration")[0]?.body).toEqual({
        rootFolder: "/audio/library",
      }),
    );
    // 成功後は settings を再取得する（staleTime=Infinityの初期データが無効化され、再フェッチが走る）
    await waitFor(() => expect(api.requestsTo("GET /api/settings")).not.toHaveLength(0));
  });

  it("送信が失敗したらエラーを表示する", async () => {
    startReply = apiError(500, "internal", "保存に失敗しました");

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
    startReply = apiError(
      400,
      "invalid_request",
      "指定されたルートフォルダーが存在しません: /no/such/path",
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
