// 実HTTPで、本文サイズ上限の超過が413になり、上限内の本文は通常どおり処理されることを検証する。
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { SERVER_MAX_REQUEST_BODY_BYTES } from "../../src/serve.ts";
import { serveFixtureTransport } from "./helpers.ts";

function postRegister(baseUrl: string, body: BodyInit): Promise<Response> {
  return fetch(`${baseUrl}/api/scan/candidates/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("上限を超える本文は413になる", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport();
  t.after(() => server.stop(true));

  const res = await postRegister(baseUrl, "x".repeat(SERVER_MAX_REQUEST_BODY_BYTES + 1));

  assert.equal(res.status, 413);
});

test("上限内の本文はルートの検証まで届く", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport();
  t.after(() => server.stop(true));

  const res = await postRegister(baseUrl, JSON.stringify({ items: [] }));

  assert.equal(res.status, 400);
});
