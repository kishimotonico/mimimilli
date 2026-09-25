import { describe, expect, it, vi } from "vitest";
import { runStartRootReconfiguration } from "../../src/app/model/runStartRootReconfiguration";

describe("runStartRootReconfiguration", () => {
  it("resume保存・開始API・settings即時反映・突入リセット・settings再取得の順に行う", async () => {
    const calls: string[] = [];
    const persistFinalResume = vi.fn(async () => {
      calls.push("persistResume");
    });
    const performEntryReset = vi.fn(async () => {
      calls.push("entryReset");
    });
    const applyRootReconfigurationState = vi.fn((state) =>
      calls.push(`applyState:${state.status}`),
    );
    const invalidateSettings = vi.fn(async () => {
      calls.push("invalidate");
    });
    const startRootReconfiguration = vi.fn(async () => {
      calls.push("start");
      return { status: "running" as const, rootFolder: "/audio/library", progress: null };
    });

    const result = await runStartRootReconfiguration("/audio/library", {
      startRootReconfiguration,
      persistFinalResume,
      performEntryReset,
      applyRootReconfigurationState,
      invalidateSettings,
    });

    expect(result).toEqual({ status: "running", rootFolder: "/audio/library", progress: null });
    expect(calls).toEqual([
      "persistResume",
      "start",
      "applyState:running",
      "entryReset",
      "invalidate",
    ]);
  });

  it("resume保存は開始APIを呼ぶ前にawaitで完了させる（並列にしない）", async () => {
    const order: string[] = [];
    let resolvePersist!: () => void;
    const persistFinalResume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolvePersist = resolve;
        }),
    );
    const startRootReconfiguration = vi.fn(async () => {
      order.push("start");
      return { status: "running" as const, rootFolder: "/audio/library", progress: null };
    });

    const donePromise = runStartRootReconfiguration("/audio/library", {
      startRootReconfiguration,
      persistFinalResume,
      performEntryReset: vi.fn(),
      applyRootReconfigurationState: vi.fn(),
      invalidateSettings: vi.fn(),
    });

    // persistFinalResumeが解決するまでstartRootReconfigurationは呼ばれない
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(startRootReconfiguration).not.toHaveBeenCalled();

    resolvePersist();
    await donePromise;
    expect(order).toEqual(["start"]);
  });

  it("202の応答をsettingsへ即時反映してから突入リセットする（再取得がidleを返す競合に対する備え）", async () => {
    // performEntryResetが解決する前の時点で、既にapplyRootReconfigurationStateが
    // runningを反映済みであることを確認する。reconfiguring画面への切り替えレンダーの
    // 猶予を、クエリ破棄より先に作るための順序。
    let settingsState: string | null = null;
    const applyRootReconfigurationState = vi.fn((state) => {
      settingsState = state.status;
    });
    let resolveEntryReset!: () => void;
    const performEntryReset = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveEntryReset = resolve;
        }),
    );
    const startRootReconfiguration = vi.fn(async () => ({
      status: "running" as const,
      rootFolder: "/audio/library",
      progress: null,
    }));

    const donePromise = runStartRootReconfiguration("/audio/library", {
      startRootReconfiguration,
      persistFinalResume: vi.fn(),
      performEntryReset,
      applyRootReconfigurationState,
      invalidateSettings: vi.fn(),
    });

    // performEntryResetがまだ解決していない時点で、既にsettingsへrunningが反映されている
    await vi.waitFor(() => expect(performEntryReset).toHaveBeenCalled());
    expect(settingsState).toBe("running");

    resolveEntryReset();
    await donePromise;
  });

  it("検証失敗（400等）ではresume保存以外（突入リセット・反映・invalidate）は呼ばない", async () => {
    const persistFinalResume = vi.fn();
    const performEntryReset = vi.fn();
    const applyRootReconfigurationState = vi.fn();
    const invalidateSettings = vi.fn();
    const startRootReconfiguration = vi.fn(async () => {
      throw new Error("指定されたルートフォルダーが存在しません");
    });

    await expect(
      runStartRootReconfiguration("/no/such/path", {
        startRootReconfiguration,
        persistFinalResume,
        performEntryReset,
        applyRootReconfigurationState,
        invalidateSettings,
      }),
    ).rejects.toThrow("指定されたルートフォルダーが存在しません");

    expect(persistFinalResume).toHaveBeenCalled();
    expect(performEntryReset).not.toHaveBeenCalled();
    expect(applyRootReconfigurationState).not.toHaveBeenCalled();
    expect(invalidateSettings).not.toHaveBeenCalled();
  });
});
