// fixture開発経路（@hono/node-server経由）でメディアルートが壊れないことのテスト。
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { getRequestListener } from "@hono/node-server";
import { test, type TestContext } from "node:test";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";

async function startFixtureNodeServer(t: TestContext) {
  const app = createApp(createFixtureAdapter());
  const listener = getRequestListener(app.fetch);
  const server = createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  if (typeof address !== "object" || address === null) throw new Error("failed to bind");
  return `http://127.0.0.1:${address.port}`;
}

test("音声配信: @hono/node-server経由（Bun Serverなし）でもエラーにならない", async (t) => {
  const baseUrl = await startFixtureNodeServer(t);
  const res = await fetch(`${baseUrl}/api/media/audio/RJ501001/track01.mp3`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/wav");
});

test("カバー画像: @hono/node-server経由（Bun Serverなし）でもエラーにならない", async (t) => {
  const baseUrl = await startFixtureNodeServer(t);
  const res = await fetch(`${baseUrl}/api/media/cover/RJ501001`);
  assert.equal(res.status, 200);
});
