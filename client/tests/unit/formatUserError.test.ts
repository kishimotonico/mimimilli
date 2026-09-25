import { describe, expect, it } from "vitest";
import { formatUserError } from "../../src/shared/lib/formatUserError";
import { ApiRequestError, ApiResponseSchemaError } from "../../src/shared/api/http";

describe("formatUserError", () => {
  it("通信不能（fetchのTypeError）はサーバー起動確認を案内する固定文言にする", () => {
    const error = new TypeError("Failed to fetch");
    const result = formatUserError(error, "設定の取得に失敗しました");
    expect(result.message).toBe(
      "mimimilliのサーバーに接続できませんでした。サーバーを起動し直してから再試行してください。",
    );
    expect(result.detail).toContain("Failed to fetch");
  });

  it("ApiRequestErrorはユーザー向けmessageをそのまま表示する", () => {
    const error = new ApiRequestError(
      400,
      "invalid_request",
      "指定されたルートフォルダーが存在しません",
    );
    const result = formatUserError(error, "fallback");
    expect(result.message).toBe("指定されたルートフォルダーが存在しません");
    expect(result.detail).toContain("指定されたルートフォルダーが存在しません");
  });

  it("ApiResponseSchemaErrorは契約エラーの固定文言にし、生の内容をdetailへ回す", () => {
    const error = new ApiResponseSchemaError("GET", "/api/settings", [
      { path: ["rootFolder"], message: "Expected string, received null" } as never,
    ]);
    const result = formatUserError(error, "fallback");
    expect(result.message).toBe(
      "サーバーの応答を正しく読み取れませんでした。時間をおいて再試行してください。",
    );
    expect(result.detail).toContain("rootFolder");
  });

  it("既に人間可読なmessageを持つErrorはそのまま表示し、スタックトレースはdetailへ添える", () => {
    const error = new Error("テスト用のレンダリングエラー");
    const result = formatUserError(error, "予期しないエラーが発生しました");
    expect(result.message).toBe("テスト用のレンダリングエラー");
    expect(result.detail).toContain("テスト用のレンダリングエラー");
  });

  it("messageが空のErrorはfallbackを表示する", () => {
    const error = new Error("");
    const result = formatUserError(error, "予期しないエラーが発生しました");
    expect(result.message).toBe("予期しないエラーが発生しました");
  });

  it("文字列化済みエラーでも通信不能パターンを検出する", () => {
    const result = formatUserError("Failed to fetch", "スキャンに失敗しました");
    expect(result.message).toBe(
      "mimimilliのサーバーに接続できませんでした。サーバーを起動し直してから再試行してください。",
    );
    expect(result.detail).toBe("Failed to fetch");
  });

  it("未知の値はfallbackのみ返しdetailはnull", () => {
    const result = formatUserError(undefined, "fallback");
    expect(result.message).toBe("fallback");
    expect(result.detail).toBeNull();
  });
});
