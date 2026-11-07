// readJsonBody / readOptionalJsonBody: 不正JSONとスキーマ不一致は同じ400でメッセージを分ける。任意ボディは省略を {} として検証する。
import { test } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { readJsonBody, readOptionalJsonBody } from "../src/lib/jsonBody.ts";

const JSON_HEADERS = { "Content-Type": "application/json" };
const schema = z.object({ full: z.boolean().optional() });

function buildApp() {
  const app = new Hono();
  app.post("/required", async (c) => c.json(await readJsonBody(c, schema, "内容が不正です")));
  app.post("/", async (c) => c.json(await readOptionalJsonBody(c, schema, "内容が不正です")));
  app.onError((error) => (error instanceof HTTPException ? error.getResponse() : new Response()));
  return app;
}

async function errorMessageOf(res: Response): Promise<string> {
  assert.equal(res.status, 400);
  const body = (await res.json()) as { error: { code: string; message: string } };
  assert.equal(body.error.code, "invalid_request");
  return body.error.message;
}

test("body省略は空オブジェクトとして検証する", async () => {
  const res = await buildApp().request("/", { method: "POST" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {});
});

test("不正なJSONは固定メッセージ、スキーマ不一致はroute指定のメッセージで400", async () => {
  const app = buildApp();
  const malformed = await app.request("/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: "{full:",
  });
  assert.equal(await errorMessageOf(malformed), "リクエストの JSON が不正です");
  const mismatch = await app.request("/", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ full: 1 }),
  });
  assert.equal(await errorMessageOf(mismatch), "内容が不正です");
  const array = await app.request("/", { method: "POST", headers: JSON_HEADERS, body: "[]" });
  assert.equal(await errorMessageOf(array), "内容が不正です");
});

test("必須ボディは本文なしでも不正JSONの固定メッセージで400", async () => {
  const app = buildApp();
  const empty = await app.request("/required", { method: "POST" });
  assert.equal(await errorMessageOf(empty), "リクエストの JSON が不正です");
  const mismatch = await app.request("/required", {
    method: "POST",
    headers: JSON_HEADERS,
    body: "{}",
  });
  assert.equal(mismatch.status, 200);
  const invalid = await app.request("/required", {
    method: "POST",
    headers: JSON_HEADERS,
    body: '{"full":1}',
  });
  assert.equal(await errorMessageOf(invalid), "内容が不正です");
});
