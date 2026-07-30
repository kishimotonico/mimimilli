import { describe, expect, it } from "vitest";
import { resolveAppStartupState } from "../../src/app/model/resolveAppStartupState";

describe("resolveAppStartupState", () => {
  it("取得中は loading", () => {
    expect(
      resolveAppStartupState({
        isPending: true,
        isError: false,
        data: undefined,
      }),
    ).toBe("loading");
  });

  it("取得失敗かつデータなしは error", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: true,
        data: undefined,
      }),
    ).toBe("error");
  });

  it("取得成功かつ rootFolder 未設定は setup-required", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: null },
      }),
    ).toBe("setup-required");
  });

  it("取得成功かつ rootFolder 設定済みは ready", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: false,
        data: { rootFolder: "/audio/library" },
      }),
    ).toBe("ready");
  });

  it("キャッシュ済みデータがある再取得失敗は ready を維持する", () => {
    expect(
      resolveAppStartupState({
        isPending: false,
        isError: true,
        data: { rootFolder: "/audio/library" },
      }),
    ).toBe("ready");
  });
});
