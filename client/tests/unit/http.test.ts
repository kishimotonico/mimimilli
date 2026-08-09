import { afterEach, describe, expect, it, vi } from "vitest";
import { getParsed } from "../../src/shared/api/http";
import { z } from "zod";

describe("http readResponseBody", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("非JSONのエラー応答でパース失敗の原因をメッセージに含める", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    await expect(getParsed(z.object({ ok: z.boolean() }), "/test")).rejects.toThrow(
      "API error 500: GET /test (応答のJSON解析に失敗しました: Internal Server Error)",
    );
  });

  it("契約形式のエラー応答は ApiRequestError としてパースする", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: "not_found", message: "missing" } }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );

    await expect(getParsed(z.object({ ok: z.boolean() }), "/test")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "missing",
    });
  });
});
