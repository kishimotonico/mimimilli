import { describe, expect, it, vi } from "vitest";
import { runStartRootReconfiguration } from "../../src/app/model/runStartRootReconfiguration";

describe("runStartRootReconfiguration", () => {
  it("成功時は再生停止・Libraryリセット・settings再取得の順に行う", async () => {
    const calls: string[] = [];
    const stopPlayback = vi.fn(() => calls.push("stop"));
    const resetLibraryForReconfiguration = vi.fn(() => calls.push("reset"));
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
      invalidateSettings,
    });

    expect(result).toEqual({ status: "running", rootFolder: "/audio/library", progress: null });
    expect(calls).toEqual(["start", "stop", "reset", "invalidate"]);
  });

  it("検証失敗（400等）では再生停止・リセット・invalidateのどれも呼ばない", async () => {
    const stopPlayback = vi.fn();
    const resetLibraryForReconfiguration = vi.fn();
    const invalidateSettings = vi.fn();
    const startRootReconfiguration = vi.fn(async () => {
      throw new Error("指定されたルートフォルダーが存在しません");
    });

    await expect(
      runStartRootReconfiguration("/no/such/path", {
        startRootReconfiguration,
        stopPlayback,
        resetLibraryForReconfiguration,
        invalidateSettings,
      }),
    ).rejects.toThrow("指定されたルートフォルダーが存在しません");

    expect(stopPlayback).not.toHaveBeenCalled();
    expect(resetLibraryForReconfiguration).not.toHaveBeenCalled();
    expect(invalidateSettings).not.toHaveBeenCalled();
  });
});
