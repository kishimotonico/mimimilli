// fixture アダプタのシナリオ機能（ADR-0002 / client/mocks/scenarios.ts からの移植）のテスト。
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";

function buildApp(scenario?: string) {
  return createApp(createFixtureAdapter({ scenario }));
}

test("シナリオ省略時は default として動作する", async () => {
  const app = buildApp();
  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(body.items.length > 0);
});

test("new-work: スキャン結果に新規作品IDが含まれる", async () => {
  const app = buildApp("new-work");

  const scanRes = await app.request("/api/scan", { method: "POST" });
  assert.equal(scanRes.status, 200);
  const scanResult = await scanRes.json();
  assert.deepEqual(scanResult.newWorkIds, ["RJ501011"]);
  assert.equal(scanResult.newlyGenerated, 1);

  // 新規作品自体は works 一覧に存在する（スキャンで見つかった扱い）
  const worksRes = await app.request("/api/works");
  const { items } = await worksRes.json();
  const ids: string[] = items.map((w: { id: string }) => w.id);
  assert.ok(ids.includes("RJ501011"));
});

test("empty: 作品・プリセット・スマートフォルダーが0件", async () => {
  const app = buildApp("empty");

  const worksRes = await app.request("/api/works");
  const worksBody = await worksRes.json();
  assert.equal(worksBody.total, 0);
  assert.deepEqual(worksBody.items, []);

  const presetsRes = await app.request("/api/presets");
  assert.deepEqual(await presetsRes.json(), []);

  const smartFoldersRes = await app.request("/api/smart-folders");
  assert.deepEqual(await smartFoldersRes.json(), []);
});

test("errors: エラー・行方不明の作品のみが含まれる", async () => {
  const app = buildApp("errors");

  const res = await app.request("/api/works");
  const { items } = await res.json();
  assert.ok(items.length > 0);
  for (const work of items) {
    assert.notEqual(work.status, "ok");
  }
  const statuses = new Set(items.map((w: { status: string }) => w.status));
  assert.ok(statuses.has("error") || statuses.has("missing"));
});

test("不明なシナリオIDはエラーになる（黙って default にフォールバックしない）", () => {
  assert.throws(
    () => createFixtureAdapter({ scenario: "no-such-scenario" }),
    /不明な MIMIMILLI_MOCK_SCENARIO/,
  );
});
