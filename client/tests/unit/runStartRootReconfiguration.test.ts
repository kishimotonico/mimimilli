import { describe, expect, it, vi } from "vitest";
import { runStartRootReconfiguration } from "../../src/app/model/runStartRootReconfiguration";

describe("runStartRootReconfiguration", () => {
  it("成功時は再生停止・Libraryリセット・settings即時反映・settings再取得の順に行う", async () => {
    const calls: string[] = [];
    const stopPlayback = vi.fn(() => calls.push("stop"));
    const resetLibraryForReconfiguration = vi.fn(() => calls.push("reset"));
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
      stopPlayback,
      resetLibraryForReconfiguration,
      applyRootReconfigurationState,
      invalidateSettings,
    });

    expect(result).toEqual({ status: "running", rootFolder: "/audio/library", progress: null });
    expect(calls).toEqual(["start", "stop", "reset", "applyState:running", "invalidate"]);
  });

  it("202の応答をsettingsへ即時反映してから再取得する（再取得がidleを返す競合に対する備え）", async () => {
    // invalidateSettingsが解決した時点では既にapplyRootReconfigurationStateが
    // runningを反映済みであることを確認する。呼び出し順の検証だけでなく、
    // invalidateSettingsの解決を遅らせても順序が変わらないことも縛る。
    let settingsState: string | null = null;
    const applyRootReconfigurationState = vi.fn((state) => {
      settingsState = state.status;
    });
    let resolveInvalidate!: () => void;
    const invalidateSettings = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveInvalidate = resolve;
        }),
    );
    const startRootReconfiguration = vi.fn(async () => ({
      status: "running" as const,
      rootFolder: "/audio/library",
      progress: null,
    }));

    const donePromise = runStartRootReconfiguration("/audio/library", {
      startRootReconfiguration,
      stopPlayback: vi.fn(),
      resetLibraryForReconfiguration: vi.fn(),
      applyRootReconfigurationState,
      invalidateSettings,
    });

    // invalidateSettingsがまだ解決していない時点で、既にsettingsへrunningが反映されている
    await vi.waitFor(() => expect(applyRootReconfigurationState).toHaveBeenCalled());
    expect(settingsState).toBe("running");

    resolveInvalidate();
    await donePromise;
  });

  it("検証失敗（400等）では再生停止・リセット・反映・invalidateのどれも呼ばない", async () => {
    const stopPlayback = vi.fn();
    const resetLibraryForReconfiguration = vi.fn();
    const applyRootReconfigurationState = vi.fn();
    const invalidateSettings = vi.fn();
    const startRootReconfiguration = vi.fn(async () => {
      throw new Error("指定されたルートフォルダーが存在しません");
    });

    await expect(
      runStartRootReconfiguration("/no/such/path", {
        startRootReconfiguration,
        stopPlayback,
        resetLibraryForReconfiguration,
        applyRootReconfigurationState,
        invalidateSettings,
      }),
    ).rejects.toThrow("指定されたルートフォルダーが存在しません");

    expect(stopPlayback).not.toHaveBeenCalled();
    expect(resetLibraryForReconfiguration).not.toHaveBeenCalled();
    expect(applyRootReconfigurationState).not.toHaveBeenCalled();
    expect(invalidateSettings).not.toHaveBeenCalled();
  });
});
