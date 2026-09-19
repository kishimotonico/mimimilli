import { describe, expect, it } from "vitest";
import { resolveAppStartupState } from "../../src/app/model/resolveAppStartupState";

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

  it("取得成功かつ rootFolder 未設定は setup-required", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: null },
        hasErroredBefore: false,
      }),
    ).toBe("setup-required");
  });

  it("取得成功かつ rootFolder 設定済みは ready", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library" },
        hasErroredBefore: false,
      }),
    ).toBe("ready");
  });

  it("キャッシュ済みデータがある再取得失敗は ready を維持する", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: true,
        data: { rootFolder: "/audio/library" },
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
