import { describe, expect, it } from "vitest";
import { ApiRequestError, ApiTransportError } from "../../src/shared/api/http";
import { sourceMutationErrorMessage } from "../../src/entities/work/sourceMutation";

describe("sourceMutationErrorMessage", () => {
  it("ApiRequestError はサーバー message をそのまま出す", () => {
    expect(
      sourceMutationErrorMessage(
        new ApiRequestError(502, "parse_error", "作品の正本が壊れているため編集できません。"),
        "fallback",
      ),
    ).toBe("作品の正本が壊れているため編集できません。");
  });

  it("ApiTransportError は通信断・中断専用の文言に統一する", () => {
    expect(sourceMutationErrorMessage(new ApiTransportError("unreachable"), "fallback")).toBe(
      "保存の結果を確認できませんでした。作品情報を読み直してください。",
    );
  });

  it("それ以外は fallback", () => {
    expect(sourceMutationErrorMessage(new Error("network"), "fallback")).toBe("fallback");
    expect(sourceMutationErrorMessage(null, "fallback")).toBe("fallback");
  });
});
