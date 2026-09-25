import { describe, expect, it } from "vitest";
import { resolveAppStartupState } from "../../src/app/model/resolveAppStartupState";

const IDLE = { status: "idle" as const };
const RUNNING = { status: "running" as const, rootFolder: "/audio/library", progress: null };
const FAILED = { status: "failed" as const, rootFolder: "/audio/library", message: "失敗しました" };

describe("resolveAppStartupState", () => {
  it("取得中は loading", () => {
    expect(
      resolveAppStartupState({
        isPending: true,
        isError: false,
        data: undefined,
        hasErroredBefore: false,
      }),
    ).toBe("loading");
  });

  it("取得失敗かつデータなしは error", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: true,
        data: undefined,
        hasErroredBefore: true,
      }),
    ).toBe("error");
  });

  it("取得成功かつ rootFolder 未設定・再設定なしは setup-required", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: null, rootReconfiguration: IDLE },
        hasErroredBefore: false,
      }),
    ).toBe("setup-required");
  });

  it("取得成功かつ rootFolder 設定済みは ready", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library", rootReconfiguration: IDLE },
        hasErroredBefore: false,
      }),
    ).toBe("ready");
  });

  it("再設定中(running)は reconfiguring", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library", rootReconfiguration: RUNNING },
        hasErroredBefore: false,
      }),
    ).toBe("reconfiguring");
  });

  it("再設定失敗(failed)は reconfiguring", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library", rootReconfiguration: FAILED },
        hasErroredBefore: false,
      }),
    ).toBe("reconfiguring");
  });

  it("初回設定の1回目が失敗しても reconfiguring（rootFolderは検証成功時点で確定済み）", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library", rootReconfiguration: FAILED },
        hasErroredBefore: false,
      }),
    ).toBe("reconfiguring");
  });

  it("キャッシュ済みデータがある再取得失敗は ready を維持する", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: true,
        data: { rootFolder: "/audio/library", rootReconfiguration: IDLE },
        hasErroredBefore: true,
      }),
    ).toBe("ready");
  });

  // TanStack Queryは一度も成功していないクエリをrefetchすると status を pending・error を null に
  // 巻き戻すため、isPending/isError だけでは初回ロードと再試行中を区別できない。
  it("一度エラーになった後の再試行中（pendingへ巻き戻る）は error のまま", () => {
    expect(
      resolveAppStartupState({
        isPending: true,
        isError: false,
        data: undefined,
        hasErroredBefore: true,
      }),
    ).toBe("error");
  });
});
