// root再設定（ADR-0029）の突入・離脱・drift検知のリセットを、Reactを使わずに縛る。
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { Settings } from "@mimimilli/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRootReconfigurationController,
  type RootReconfigurationControllerDeps,
} from "../../src/app/model/rootReconfigurationController";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import * as scanApi from "../../src/entities/scan/api";
import * as scanCandidatesCache from "../../src/entities/scan/scanCandidatesCache";

const SCAN_RESULT = {
  registered: 0,
  insertedWorkIds: ["work-1"] as string[],
  updatedWorkIds: [],
  errors: 0,
  missing: 0,
  skipped: 0,
  coverErrors: 0,
};

function idleSettings(rootFolder: string, completedAt: string | null): Settings {
  return {
    rootFolder,
    lastScanTime: null,
    rootReconfiguration: { status: "idle", completedAt },
  } as Settings;
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
    vi.restoreAllMocks();
    vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: SCAN_RESULT,
      finishedAt: "2026-01-01T00:00:00.000Z",
    });
    vi.spyOn(scanCandidatesCache, "refreshScanCandidates").mockResolvedValue([]);
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
    expect(scanCandidatesCache.refreshScanCandidates).not.toHaveBeenCalled();
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
    expect(scanCandidatesCache.refreshScanCandidates).toHaveBeenCalledWith(queryClient);
    unsubscribe();
  });

  it("ロック中は通常UIが残っていても離脱させず、解除後に1回だけ行う", async () => {
    const { controller, deps, queryClient } = setup();
    queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), {
      rootFolder: "/audio/library",
      lastScanTime: null,
      rootReconfiguration: { status: "running", rootFolder: "/b", progress: null },
    });
    controller.enter();

    controller.readyUiMounted();
    expect(scanApi.getLastScanResult).not.toHaveBeenCalled();

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
    expect(scanApi.getLastScanResult).toHaveBeenCalledTimes(1);
  });

  it("次の突入ではまた離脱後処理が走る（取りこぼさない）", async () => {
    const { controller, deps } = setup();

    controller.enter();
    controller.readyUiMounted();
    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
    controller.enter();
    controller.readyUiMounted();

    await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(2));
    expect(scanApi.getLastScanResult).toHaveBeenCalledTimes(2);
  });

  it("insertedWorkIdsが空ならDLsite一括取得にattachしない", async () => {
    vi.spyOn(scanApi, "getLastScanResult").mockResolvedValue({
      result: { ...SCAN_RESULT, insertedWorkIds: [] },
      finishedAt: "2026-01-01T00:00:00.000Z",
    });
    const { controller, deps } = setup();

    controller.enter();
    controller.readyUiMounted();

    await vi.waitFor(() => expect(scanApi.getLastScanResult).toHaveBeenCalledTimes(1));
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
      controller.observeSettings({
        rootFolder: "/a",
        lastScanTime: null,
        rootReconfiguration: { status: "running", rootFolder: "/b", progress: null },
      } as Settings);
      controller.readyUiMounted();
      controller.observeSettings(idleSettings("/b", "2026-01-01T00:05:00.000Z"));
      controller.readyUiMounted();

      expect(controller.getEntryCount()).toBe(1);
      expect(deps.stopPlayback).toHaveBeenCalledTimes(1);
      expect(deps.navigateToDefaultRoute).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(deps.dlsiteBulk.attach).toHaveBeenCalledTimes(1));
      expect(scanApi.getLastScanResult).toHaveBeenCalledTimes(1);
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

      controller.observeSettings({
        rootFolder: "/a",
        lastScanTime: null,
        rootReconfiguration: { status: "running", rootFolder: "/a", progress: null },
      } as Settings);
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
