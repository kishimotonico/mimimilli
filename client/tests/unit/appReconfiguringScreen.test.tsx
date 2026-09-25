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
import * as workApi from "../../src/entities/work/api";
import * as scanApi from "../../src/features/scan/api";
import type { Settings } from "@mimimilli/shared";

const EMPTY_SCAN_RESULT = {
  registered: 0,
  insertedWorkIds: [] as string[],
  updatedWorkIds: [],
  errors: 0,
  missing: 0,
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
  identityConflicts: [],
  invalidMetaFiles: [],
  candidates: [],
};

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
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json" } }),
    ),
  );
});

describe("root再設定中の画面", () => {
  it("running中はRootConfigurationScreenのみが描画され、通常UI（LeftNav等）は出ない", async () => {
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

  it("failed中はRootConfigurationScreenが失敗表示で出て、通常UIは出ない", async () => {
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

describe("root再設定完了後のDLsite自動取得attach", () => {
  // settings更新→reconfiguring突入検知effect→queryClient.fetchQuery→.then→attach()→
  // getDlsiteBulkStatusという多段の非同期チェーンを待つ。汎用fetchスタブ経由の
  // JSON往復（stringify/Response/zod解析）を挟むと並列実行時の負荷でwaitFor既定の
  // 1000msを超えてflakyになるため、getLastScanResultを直接spyしてチェーンを短くし、
  // 明示的に長めのtimeoutも与えて安定させる。
  it("新規作品があればdlsiteBulk.attach相当（getDlsiteBulkStatus）を呼ぶ", async () => {
    const getDlsiteBulkStatus = vi.spyOn(workApi, "getDlsiteBulkStatus").mockResolvedValue(null);
    vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: { ...EMPTY_SCAN_RESULT, insertedWorkIds: ["work-1"] },
      finishedAt: "2026-01-01T00:00:00.000Z",
    });

    const { queryClient } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: {
        status: "running",
        rootFolder: "/audio/library",
        progress: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle" },
    });

    await waitFor(() => expect(getDlsiteBulkStatus).toHaveBeenCalled(), { timeout: 5000 });
  });

  it("新規作品が無ければgetDlsiteBulkStatusを呼ばない", async () => {
    const getDlsiteBulkStatus = vi.spyOn(workApi, "getDlsiteBulkStatus").mockResolvedValue(null);
    const getLastScanResult = vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: EMPTY_SCAN_RESULT,
      finishedAt: "2026-01-01T00:00:00.000Z",
    });

    const { queryClient } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: {
        status: "running",
        rootFolder: "/audio/library",
        progress: null,
      },
    });
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle" },
    });

    // getDlsiteBulkStatusが呼ばれないことの確認は「呼ばれる経路自体は完了した」ことを
    // 待ってから行う。そうしないと、まだチェーンの途中（getLastScanResult未解決）な
    // だけで判定してしまい、偽陰性（呼ばれるはずが間に合わず未検出）になりうる。
    await waitFor(() => expect(getLastScanResult).toHaveBeenCalled(), { timeout: 5000 });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(getDlsiteBulkStatus).not.toHaveBeenCalled();
  });
});
