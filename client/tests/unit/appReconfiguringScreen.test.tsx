import { createElement, useMemo } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../src/app/App";
import DlsiteBulkRuntime from "../../src/features/dlsite/ui/DlsiteBulkRuntime";
import DlsiteBulkApplyRuntime from "../../src/features/dlsite/ui/DlsiteBulkApplyRuntime";
import ScanRuntime from "../../src/features/scan/ui/ScanRuntime";
import NavigationHistorySync from "../../src/features/navigation/ui/NavigationHistorySync";
import { PlayerRuntimeProvider } from "../../src/entities/player/model/PlayerRuntimeProvider";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { dlsiteBulkApplyOpenAtom } from "../../src/entities/dlsite/model/bulkAtoms";
import { appModeAtom, setAppModeAtom } from "../../src/entities/navigation/model/appRouteStore";
import {
  filesRelPathAtom,
  filesSelectedPathAtom,
  openPathInFilesAtom,
} from "../../src/entities/file-system/model/navigationAtoms";
import {
  librarySearchQueryAtom,
  selectedTagsAtom,
  sortAtom,
} from "../../src/entities/library/model/navigationAtoms";
import type { Settings } from "@mimimilli/shared";
import { mockApi, type ApiMock } from "../helpers/api";
import { appShellRoutes } from "../helpers/appShellApi";
import { buildScanLastResult, buildScanResult, buildSettings } from "../helpers/builders";

const DLSITE_BULK_ROUTE = "GET /api/dlsite/bulk";
const LAST_SCAN_ROUTE = "GET /api/scan/last";
const PREVIEW_ROUTE = "POST /api/dlsite/apply-missing/preview";

let api: ApiMock;
let insertedWorkIds: string[];
let serverSettings: Settings;
let previewReply: () => unknown;

function settingsOf(
  rootReconfiguration: Settings["rootReconfiguration"],
  lastScanTime: string | null = "2026-01-01T00:00:00.000Z",
): Settings {
  return buildSettings({ rootFolder: "/audio/library", lastScanTime, rootReconfiguration });
}

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
          createElement(NavigationHistorySync),
          createElement(ScanRuntime),
          createElement(App),
        ),
      ),
    );
  }

  render(createElement(Wrapper));
  return { queryClient, store };
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

// SettingsModalはlazy importのため、初回のモジュール変換を各テストの待機に含めないよう先に読み込む。
// 設定モーダルを開く待機は無負荷でも約300msかかるため、waitFor既定の1000msでなく5000msを与える。
beforeAll(async () => {
  await import("../../src/features/settings/ui/SettingsModal");
});

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  history.replaceState(null, "", "/");
  insertedWorkIds = [];
  serverSettings = settingsOf({ status: "idle", completedAt: null });
  previewReply = () => new Promise(() => {});
  api = mockApi(
    appShellRoutes({
      "GET /api/settings": () => serverSettings,
      [LAST_SCAN_ROUTE]: () =>
        buildScanLastResult({ result: buildScanResult({ insertedWorkIds }) }),
      [PREVIEW_ROUTE]: () => previewReply(),
      "POST /api/root-reconfiguration": () => ({
        status: "running",
        rootFolder: "/new/root",
        progress: null,
      }),
    }),
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
    renderAppWithSettings(
      settingsOf({
        status: "running",
        rootFolder: "/audio/library",
        progress: { type: "progress", phase: "walking", processed: 1, total: 10 },
      }),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });

  it("failed中はRootConfigurationScreenが失敗表示で出て、通常UIは出ない", async () => {
    renderAppWithSettings(
      settingsOf(
        {
          status: "failed",
          rootFolder: "/audio/library",
          message: "ルートフォルダーにアクセスできません",
        },
        null,
      ),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリの再構築に失敗しました")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("idleでrootFolder設定済みなら通常UI（Library）が描画される", async () => {
    renderAppWithSettings(settingsOf({ status: "idle", completedAt: null }));

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByText("ライブラリを再構築しています")).not.toBeInTheDocument();
  });
});

describe("root再設定完了後のDLsite自動取得attach", () => {
  // settings更新→reconfiguring突入検知effect→queryClient.fetchQuery→.then→attach()→
  // DLsite一括取得の状態取得という多段の非同期チェーンを待つ。並列実行時の負荷でwaitFor既定の
  // 1000msを超えうるため、明示的に長めのtimeoutを与えて安定させる。
  it("新規作品があればDLsite一括取得の状態を取得してattachする", async () => {
    insertedWorkIds = ["work-1"];

    const { queryClient } = renderAppWithSettings(
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "idle", completedAt: null }),
    );

    await waitFor(() => expect(api.requestsTo(DLSITE_BULK_ROUTE)).not.toHaveLength(0), {
      timeout: 5000,
    });
  });

  it("新規作品が無ければDLsite一括取得の状態を取得しない", async () => {
    const { queryClient } = renderAppWithSettings(
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "idle", completedAt: null }),
    );

    // DLsite一括取得の状態が取得されないことの確認は「取得する経路自体は完了した」ことを
    // 待ってから行う。そうしないと、まだチェーンの途中（直近スキャン結果が未解決）な
    // だけで判定してしまい、偽陰性（取得されるはずが間に合わず未検出）になりうる。
    await waitFor(() => expect(api.requestsTo(LAST_SCAN_ROUTE)).not.toHaveLength(0), {
      timeout: 5000,
    });
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(api.requestsTo(DLSITE_BULK_ROUTE)).toHaveLength(0);
  });
});

describe("root再設定突入時のモーダル初期化", () => {
  it("設定モーダルを開いたままreconfiguringに入ると閉じ、復帰後も開いたままにならない", async () => {
    const { queryClient } = renderAppWithSettings(
      settingsOf({ status: "idle", completedAt: null }),
    );
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument(), {
      timeout: 5000,
    });

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog", { name: "設定" })).not.toBeInTheDocument();

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "idle", completedAt: null }),
    );

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(screen.queryByRole("dialog", { name: "設定" })).not.toBeInTheDocument();
  });
});

describe("root再設定突入時のDLsite一括適用ダイアログ初期化", () => {
  it("プレビューを開いたままreconfiguringに入ると閉じる", async () => {
    // プレビュー取得を解決させないことで、dlsiteBulkApplyOpenAtomがopen中の
    // 内部エフェクト（失敗時に自動でreset()する）に邪魔されず、突入リセットだけを縛れる。
    previewReply = () => new Promise(() => {});

    const { queryClient, store } = renderAppWithSettings(
      settingsOf({ status: "idle", completedAt: null }),
    );
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    store.set(dlsiteBulkApplyOpenAtom, true);
    expect(store.get(dlsiteBulkApplyOpenAtom)).toBe(true);

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );

    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    expect(store.get(dlsiteBulkApplyOpenAtom)).toBe(false);
  });
});

describe("root再設定の高速完了（runningが描画されない）競合", () => {
  it("settings再取得がidleを即座に返しても、突入側のクエリ破棄と離脱側のDLsite attachが行われる", async () => {
    // invalidateSettings（GET /api/settings再取得）が即座にidleを返す競合を模す。
    // Reactが中間状態（running）の描画を挟まないケースでも、performEntryReset・
    // leavePendingは描画観測に依存せず必ず立つ想定。
    serverSettings = buildSettings({
      rootFolder: "/new/root",
      lastScanTime: "2026-01-01T00:00:00.000Z",
      rootReconfiguration: { status: "idle", completedAt: null },
    });
    insertedWorkIds = ["work-2"];

    const { queryClient } = renderAppWithSettings(
      settingsOf({ status: "idle", completedAt: null }),
    );
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { id: "work-1" });

    fireEvent.click(screen.getByRole("button", { name: "設定" }));
    await waitFor(() => expect(screen.getByRole("dialog", { name: "設定" })).toBeInTheDocument(), {
      timeout: 5000,
    });
    fireEvent.click(screen.getByRole("button", { name: "変更" }));
    fireEvent.change(screen.getByLabelText("ルートフォルダーのパス"), {
      target: { value: "/new/root" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(api.requestsTo(DLSITE_BULK_ROUTE)).not.toHaveLength(0), {
      timeout: 5000,
    });
    expect(queryClient.getQueryData(WORK_QUERY_KEYS.detail("work-1"))).toBeUndefined();
  });
});

describe("root再設定とナビゲーションの既定化", () => {
  it("Files表示中にdriftが起きるとLibrary既定画面に戻り、URLも既定へ置き換わる", async () => {
    history.replaceState(null, "", "/library/all?tags=cv%2Fa&sort=title-asc&q=old");
    const { queryClient, store } = renderAppWithSettings(
      settingsOf({ status: "idle", completedAt: "2026-01-01T00:00:00.000Z" }),
    );
    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());

    act(() => store.set(openPathInFilesAtom, { path: "dlsite/work.mp3", root: "/audio/library" }));
    expect(store.get(appModeAtom)).toBe("files");
    expect(currentUrl()).toBe("/files/dlsite?sel=dlsite%2Fwork.mp3");

    // 別タブが同じrootFolderへ再設定を完了させた体（rootFolderは変わらずcompletedAtだけ進む）。
    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "idle", completedAt: "2026-01-01T00:05:00.000Z" }),
    );

    await waitFor(() => expect(store.get(appModeAtom)).toBe("library"));
    expect(store.get(filesRelPathAtom)).toEqual([]);
    expect(store.get(filesSelectedPathAtom)).toBeNull();
    expect(store.get(selectedTagsAtom)).toEqual([]);
    expect(store.get(librarySearchQueryAtom)).toBe("");
    expect(store.get(sortAtom)).toBe("added-desc");
    expect(currentUrl()).toBe("/library/all");
  });

  it("再設定の画面へ入った時点でURLが既定になり、通常画面へ戻っても古い状態を復元しない", async () => {
    history.replaceState(null, "", "/library/all?tags=cv%2Fa&sort=title-asc&q=old");
    const { queryClient, store } = renderAppWithSettings(
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );
    await waitFor(() => expect(currentUrl()).toBe("/library/all"));

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      settingsOf({ status: "idle", completedAt: "2026-01-01T00:05:00.000Z" }),
    );

    await waitFor(() => expect(screen.queryByRole("navigation")).toBeInTheDocument());
    expect(store.get(selectedTagsAtom)).toEqual([]);
    expect(store.get(librarySearchQueryAtom)).toBe("");
    expect(store.get(sortAtom)).toBe("added-desc");
    expect(currentUrl()).toBe("/library/all");
  });

  it("再設定の画面の表示中にrouteが変わってもURLへ反映するだけで、通常画面は描画しない", async () => {
    const { store } = renderAppWithSettings(
      settingsOf({ status: "running", rootFolder: "/audio/library", progress: null }),
    );
    await waitFor(() =>
      expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument(),
    );

    act(() => store.set(setAppModeAtom, "files"));

    expect(currentUrl()).toBe("/files");
    expect(screen.getByText("ライブラリを再構築しています")).toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
