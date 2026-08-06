import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/shared/api/http";
import { mutationErrorMessage } from "../../src/shared/lib/mutationError";

describe("mutationErrorMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("ApiRequestError ならサーバー由来の message を返す", () => {
    const error = new ApiRequestError(400, "VALIDATION", "タイトルが長すぎます");
    expect(mutationErrorMessage(error, "タイトルを保存できませんでした。")).toBe(
      "タイトルが長すぎます",
    );
  });

  it("TypeError などユーザー向けでない Error は fallback を返し、原因をログに残す", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = new TypeError("Failed to fetch");

    expect(mutationErrorMessage(error, "タイトルを保存できませんでした。")).toBe(
      "タイトルを保存できませんでした。",
    );
    expect(consoleError).toHaveBeenCalledWith("タイトルを保存できませんでした。", error);
  });

  it("それ以外はフォールバックを返す", () => {
    expect(mutationErrorMessage("oops", "失敗しました")).toBe("失敗しました");
  });
});
