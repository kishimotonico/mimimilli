// root再設定（ADR-0029）の突入・離脱・drift検知のリセットを、Reactを使わずに縛る。
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRootReconfigurationController,
  type RootReconfigurationControllerDeps,
} from "../../src/app/model/rootReconfigurationController";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SCAN_CANDIDATES_QUERY_KEY } from "../../src/entities/scan/scanCandidatesCache";
import { mockApi, type ApiMock } from "../helpers/api";
import { buildScanLastResult, buildScanResult, buildSettings } from "../helpers/builders";

const LAST_SCAN_ROUTE = "GET /api/scan/last";
const CANDIDATES_ROUTE = "GET /api/scan/candidates";

let api: ApiMock;
let insertedWorkIds: string[];

function idleSettings(rootFolder: string, completedAt: string | null) {
  return buildSettings({ rootFolder, rootReconfiguration: { status: "idle", completedAt } });
}

function runningSettings(rootFolder: string, target: string) {
  return buildSettings({
    rootFolder,
    rootReconfiguration: { status: "running", rootFolder: target, progress: null },
  });
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), idleSettings("/audio/library", null));
  const calls: string[] = [];
  const deps = {
    queryClient,
    stopPlayback: vi.fn(() => void calls.push("stopPlayback")),
    closeActiveModal: vi.fn(() => void calls.push("closeActiveModal")),
    closeDlsiteApplyDialog: vi.fn(() => void calls.push("closeDlsiteApplyDialog")),
    scanJob: { reset: vi.fn(() => void calls.push("scanReset")) },
    dlsiteBulk: {
      reset: vi.fn(() => void calls.push("dlsiteReset")),
      attach: vi.fn(async () => {}),
    },
    navigateToDefaultRoute: vi.fn(() => void calls.push("navigate")),
    clearScanCandidateHiddenPaths: vi.fn(() => void calls.push("clearHiddenPaths")),
  } satisfies RootReconfigurationControllerDeps;
  return { queryClient, deps, calls, controller: createRootReconfigurationController(deps) };
}

describe("rootReconfigurationController", () => {
  beforeEach(() => {
    insertedWorkIds = ["work-1"];
    api = mockApi({
      [LAST_SCAN_ROUTE]: () =>
        buildScanLastResult({ result: buildScanResult({ insertedWorkIds }) }),
      [CANDIDATES_ROUTE]: { candidates: [] },
    });
  });

  it("突入で再生停止・モーダル閉・DLsite適用ダイアログ閉・scan/DLsiteのreset・既定画面へ遷移・hiddenPaths破棄を行う", () => {
    const { controller, calls } = setup();

    controller.enter();

    expect(calls).toEqual([
      "stopPlayback",
      "closeActiveModal",
      "closeDlsiteApplyDialog",
      "scanReset",
      "dlsiteReset",
      "navigate",
      "clearHiddenPaths",
    ]);
  });

  it("突入時は作品系クエリをstale化するだけで破棄しない", () => {
    const { controller, queryClient } = setup();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { seeded: true });

    controller.enter();

    const state = queryClient.getQueryState(WORK_QUERY_KEYS.detail("work-1"));
    expect(state?.isInvalidated).toBe(true);
    expect(queryClient.getQueryData(WORK_QUERY_KEYS.detail("work-1"))).toEqual({ seeded: true });
  });

  it("reconfiguring画面のマウント後に作品系クエリを破棄する", () => {
    const { controller, queryClient } = setup();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { seeded: true });
    queryClient.setQueryData(["settings"], { rootFolder: "/a" });

    controller.enter();
    controller.reconfiguringUiMounted();

    expect(queryClient.getQueryData(WORK_QUERY_KEYS.detail("work-1"))).toBeUndefined();
    expect(queryClient.getQueryData(["settings"])).toEqual({ rootFolder: "/a" });
  });

  it("初回のreadyでは何もリセットしない", () => {
    const { controller, deps, queryClient } = setup();
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { seeded: true });

    controller.readyUiMounted();

    expect(deps.stopPlayback).not.toHaveBeenCalled();
    expect(api.requestsTo(CANDIDATES_ROUTE)).toHaveLength(0);
    expect(deps.dlsiteBulk.attach).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("work-1"))?.isInvalidated).toBe(false);
  });

  it("離脱ではobserverのいる作品系クエリを再取得し、候補を取り直し、挿入ありならDLsite一括取得にattachする", async () => {
    const { controller, deps, queryClient } = setup();
    controller.enter();
    controller.reconfiguringUiMounted();
    const queryFn = vi.fn().mockResolvedValue({ fresh: true });
    const observer = new QueryObserver(queryClient, {
      queryKey: WORK_QUERY_KEYS.detail("work-1"),
      queryFn,
    });
    const unsubscribe = observer.subscribe(() => {});
    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(1));

    controller.readyUiMounted();

    await vi.waitFor(() => expect(queryFn).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(queryClient.getQueryData(SCAN_CANDIDATES_QUERY_KEY)).toEqual([]));
    expect(api.requestsTo(CANDIDATES_ROUTE)).toHaveLength(1);
    unsubscribe();
  });

  it("ロック中は通常UIが残っていても離脱させず、解除後に1回だけ行う", async () => {
    const { controller, deps, queryClient } = setup();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), runningSettings("/audio/library", "/b"));
    controller.enter();

    controller.readyUiMounted();
    expect(api.requestsTo(LAST_SCAN_ROUTE)).toHaveLength(0);

    queryClient.setQueryData(
      SETTINGS_QUERY_KEYS.all(),
      idleSettings("/b", "2026-01-01T00:05:00.000Z"),
    );
    controller.readyUiMounted();

    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
  });

  it("離脱後処理は1回の突入につき1回だけ（readyUiMountedの重複呼び出しでは再実行しない）", async () => {
    const { controller, deps } = setup();

    controller.enter();
    controller.readyUiMounted();
    controller.readyUiMounted();

    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
    expect(api.requestsTo(LAST_SCAN_ROUTE)).toHaveLength(1);
  });

  it("次の突入ではまた離脱後処理が走る（取りこぼさない）", async () => {
    const { controller, deps } = setup();

    controller.enter();
    controller.readyUiMounted();
    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
    controller.enter();
    controller.readyUiMounted();

    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(2));
    expect(api.requestsTo(LAST_SCAN_ROUTE)).toHaveLength(2);
  });

  it("insertedWorkIdsが空ならDLsite一括取得にattachしない", async () => {
    insertedWorkIds = [];
    const { controller, deps } = setup();

    controller.enter();
    controller.readyUiMounted();

    await vi.waitFor(() => expect(api.requestsTo(LAST_SCAN_ROUTE)).toHaveLength(1));
    await Promise.resolve();
    expect(deps.dlsiteBulk.attach).not.toHaveBeenCalled();
  });

  it("突入するたびに購読者へ通知し、購読解除後は通知しない", () => {
    const { controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribeEntries(listener);

    controller.enter();
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    controller.enter();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(controller.getEntryCount()).toBe(2);
  });

  describe("startupStateの観測", () => {
    it("reconfiguringへ切り替わった瞬間にだけ突入する", () => {
      const { controller, deps } = setup();

      controller.observeStartupState(false);
      expect(deps.stopPlayback).not.toHaveBeenCalled();
      controller.observeStartupState(true);
      controller.observeStartupState(true);

      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
    });
  });

  describe("settingsの観測（drift検知）", () => {
    it("初回観測は基準を記録するだけで発火しない", () => {
      const { controller, deps } = setup();

      controller.observeSettings(idleSettings("/audio/library", null));

      expect(deps.stopPlayback).not.toHaveBeenCalled();
    });

    it("rootFolderが同じでもcompletedAtだけ変わっていれば突入し、離脱後処理はreadyUiMountedで行う", async () => {
      const { controller, deps, queryClient } = setup();
      queryClient.setQueryData(WORK_QUERY_KEYS.detail("work-1"), { seeded: true });
      controller.observeSettings(idleSettings("/audio/library", "2026-01-01T00:00:00.000Z"));

      controller.observeSettings(idleSettings("/audio/library", "2026-01-01T00:05:00.000Z"));

      expect(controller.getEntryCount()).toBe(1);
      expect(deps.dlsiteBulk.attach).not.toHaveBeenCalled();
      controller.readyUiMounted();
      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
      expect(deps.navigateToDefaultRoute).toHaveBeenCalledTimes(1);
      expect(deps.scanJob.reset).toHaveBeenCalledTimes(1);
      expect(deps.dlsiteBulk.reset).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
      expect(queryClient.getQueryData(WORK_QUERY_KEYS.detail("work-1"))).toBeUndefined();
    });

    it("自分で開始した再設定の完了では、突入も離脱後処理も1回だけ", async () => {
      const { controller, deps } = setup();
      controller.observeSettings(idleSettings("/a", "2026-01-01T00:00:00.000Z"));

      controller.enter();
      controller.observeSettings(runningSettings("/a", "/b"));
      controller.readyUiMounted();
      controller.observeSettings(idleSettings("/b", "2026-01-01T00:05:00.000Z"));
      controller.readyUiMounted();

      expect(controller.getEntryCount()).toBe(1);
      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
      expect(deps.navigateToDefaultRoute).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
      expect(api.requestsTo(LAST_SCAN_ROUTE)).toHaveLength(1);
    });

    it("rootFolderが変わっても発火する", () => {
      const { controller, deps } = setup();
      controller.observeSettings(idleSettings("/a", "2026-01-01T00:00:00.000Z"));

      controller.observeSettings(idleSettings("/b", "2026-01-01T00:00:00.000Z"));

      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
    });

    it("変化が無ければ発火しない", () => {
      const { controller, deps } = setup();
      controller.observeSettings(idleSettings("/a", null));

      controller.observeSettings(idleSettings("/a", null));

      expect(deps.stopPlayback).not.toHaveBeenCalled();
    });

    it("reconfiguring中（status!==idle）はスキップし基準を更新しない", () => {
      const { controller, deps } = setup();
      controller.observeSettings(idleSettings("/a", "2026-01-01T00:00:00.000Z"));

      controller.observeSettings(runningSettings("/a", "/a"));
      expect(deps.stopPlayback).not.toHaveBeenCalled();

      controller.observeSettings(idleSettings("/a", "2026-01-01T00:10:00.000Z"));
      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
    });

    it("settings未取得はスキップする", () => {
      const { controller, deps } = setup();

      controller.observeSettings(undefined);

      expect(deps.stopPlayback).not.toHaveBeenCalled();
    });
  });
});
