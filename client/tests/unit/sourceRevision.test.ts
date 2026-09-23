import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/shared/api/http";
import { sourceEditErrorMessage } from "../../src/entities/work/sourceRevision";

describe("sourceEditErrorMessage", () => {
  it("ApiRequestError はサーバー message をそのまま出す", () => {
    expect(
      sourceEditErrorMessage(
        new ApiRequestError(502, "parse_error", "作品の正本が壊れているため編集できません。"),
        "fallback",
      ),
    ).toBe("作品の正本が壊れているため編集できません。");
  });

  it("通常の Error は message を出す", () => {
    expect(sourceEditErrorMessage(new Error("network"), "fallback")).toBe("network");
  });

  it("不明な値は fallback", () => {
    expect(sourceEditErrorMessage(null, "fallback")).toBe("fallback");
  });
});
