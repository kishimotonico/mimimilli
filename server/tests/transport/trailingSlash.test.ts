// /api と /api/ のルーティングが実HTTPで同じ結果になることを検証する。
// 実在ルートに末尾スラッシュを付けると 404 になるのは Hono strict モードの既定挙動。
import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { serveFixtureTransport } from "./helpers.ts";

async function expectSameResponse(
  baseUrl: string,
  leftPath: string,
  rightPath: string,
): Promise<void> {
  const left = await fetch(`${baseUrl}${leftPath}`);
  const right = await fetch(`${baseUrl}${rightPath}`);
  assert.equal(left.status, right.status, `${leftPath} と ${rightPath} のステータス`);
  const leftBody = (await left.json()) as { error?: { code?: string } };
  const rightBody = (await right.json()) as { error?: { code?: string } };
  assert.equal(
    leftBody.error?.code,
    rightBody.error?.code,
    `${leftPath} と ${rightPath} の error.code`,
  );
}

test("/api と /api/ はステータスとエラーコードが一致する", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport();
  t.after(() => server.stop(true));

  await expectSameResponse(baseUrl, "/api", "/api/");
});

test("実在ルートは末尾スラッシュなしで正しく応答する", async (t: TestContext) => {
  const { server, baseUrl } = serveFixtureTransport();
  t.after(() => server.stop(true));

  const settings = await fetch(`${baseUrl}/api/settings`);
  assert.equal(settings.status, 200);
  const settingsBody = await settings.json();
  assert.equal(typeof settingsBody.rootFolder, "string");

  const works = await fetch(`${baseUrl}/api/works`);
  assert.equal(works.status, 200);
  const worksBody = await works.json();
  assert.ok(Array.isArray(worksBody.items));
});
