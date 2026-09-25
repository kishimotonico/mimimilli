import { createElement, useMemo } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import { PlayerRuntimeProvider } from "../../src/features/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { dlsiteBulkApplyOpenAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { appModeAtom } from "../../src/shared/model/appModeAtoms";
import {
  filesRelPathAtom,
  filesSelectedPathAtom,
} from "../../src/entities/file-system/model/navigationAtoms";
import * as workApi from "../../src/entities/work/api";
import * as scanApi from "../../src/features/scan/api";
import * as settingsApi from "../../src/entities/settings/api";
import { workspacePath, type Settings } from "@mimimilli/shared";

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
  const store = createStore();

  function Wrapper() {
    const client = useMemo(() => queryClient, []);
    return createElement(
      QueryClientProvider,
      { client },
      createElement(
        JotaiProvider,
        { store },
        createElement(
          PlayerRuntimeProvider,
          null,
          createElement(DlsiteBulkRuntime),
          createElement(DlsiteBulkApplyRuntime),
          createElement(ScanRuntime),
          createElement(App),
        ),
      ),
    );
  }

  render(createElement(Wrapper));
  return { queryClient, store };
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
  // happy-domはネイティブ<dialog>のshowModal/closeを実装していないため、
  // SettingsModalを開くテストのためにスタブする（settingsModal.test.tsと同様）。
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
    this.open = false;
  });
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
      rootReconfiguration: { status: "idle", completedAt: null },
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
    const getDlsiteBulkStatus = vi
      .spyOn(workApi, "getDlsiteBulkStatus")
      .mockResolvedValue({ current: null, lastTerminal: null });
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
      rootReconfiguration: { status: "idle", completedAt: null },
    });

    await waitFor(() => expect(getDlsiteBulkStatus).toHaveBeenCalled(), { timeout: 5000 });
  });

  it("新規作品が無ければgetDlsiteBulkStatusを呼ばない", async () => {
    const getDlsiteBulkStatus = vi
      .spyOn(workApi, "getDlsiteBulkStatus")
      .mockResolvedValue({ current: null, lastTerminal: null });
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
      rootReconfiguration: { status: "idle", completedAt: null },
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

describe("root再設定突入時のモーダル初期化", () => {
  it("設定モーダルを開いたままreconfiguringに入ると閉じ、復帰後も開いたままにならない", async () => {
    const { queryClient } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument());

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
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
    expect(screen.queryByRole("dialog", { name: "設定" })).not.toBeInTheDocument();

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "設定" })).not.toBeInTheDocument();
  });
});

describe("root再設定突入時のDLsite一括適用ダイアログ初期化", () => {
  it("プレビューを開いたままreconfiguringに入ると閉じる", async () => {
    // previewDlsiteMissingを解決させないことで、dlsiteBulkApplyOpenAtomがopen中の
    // 内部エフェクト（失敗時に自動でreset()する）に邪魔されず、突入リセットだけを縛れる。
    vi.spyOn(workApi, "previewDlsiteMissing").mockReturnValue(new Promise(() => {}));

    const { queryClient, store } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    store.set(dlsiteBulkApplyOpenAtom, true);
    expect(store.get(dlsiteBulkApplyOpenAtom)).toBe(true);

    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
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
    expect(store.get(dlsiteBulkApplyOpenAtom)).toBe(false);
  });
});

describe("root再設定の高速完了（runningが描画されない）競合", () => {
  it("settings再取得がidleを即座に返しても、突入側のクエリ破棄と離脱側のDLsite attachが行われる", async () => {
    vi.spyOn(settingsApi, "startRootReconfiguration").mockResolvedValue({
      status: "running",
      rootFolder: "/new/root",
      progress: null,
    });
    // invalidateSettings（GET /api/settings再取得）が即座にidleを返す競合を模す。
    // Reactが中間状態（running）の描画を挟まないケースでも、performEntryReset・
    // reconfigurationExitEpochAtomは描画観測に依存せず必ず進む想定。
    vi.spyOn(settingsApi, "getSettings").mockResolvedValue({
      rootFolder: "/new/root",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: { ...EMPTY_SCAN_RESULT, insertedWorkIds: ["work-2"] },
      finishedAt: "2026-01-01T00:00:00.000Z",
    });
    const getDlsiteBulkStatus = vi
      .spyOn(workApi, "getDlsiteBulkStatus")
      .mockResolvedValue({ current: null, lastTerminal: null });

    const { queryClient } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { id: "work-1" });

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("ルートフォルダーのパス"), {
      target: { value: "/new/root" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(getDlsiteBulkStatus).toHaveBeenCalled(), { timeout: 5000 });
    expect(queryClient.getQueryData(WORK_QUERY_KEYS.detail("work-1"))).toBeUndefined();
  });
});

describe("別タブでの再設定完了検知（drift）時のナビゲーション初期化", () => {
  it("Files表示中にdriftが起きるとLibrary既定画面に戻る", async () => {
    const { queryClient, store } = renderAppWithSettings({
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:00:00.000Z" },
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    store.set(appModeAtom, "files");
    store.set(filesRelPathAtom, ["dlsite"]);
    store.set(filesSelectedPathAtom, workspacePath("dlsite/work.mp3"));
    expect(store.get(appModeAtom)).toBe("files");

    // 別タブが同じrootFolderへ再設定を完了させた体（rootFolderは変わらずcompletedAtだけ進む）。
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: "2026-01-01T00:05:00.000Z" },
    });

    await waitFor(() => expect(store.get(appModeAtom)).toBe("library"));
    expect(store.get(filesRelPathAtom)).toEqual([]);
    expect(store.get(filesSelectedPathAtom)).toBeNull();
  });
});
