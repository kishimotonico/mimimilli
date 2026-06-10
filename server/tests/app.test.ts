import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";

function buildApp() {
  return createApp(createFixtureAdapter());
}

test("GET /api/works は {items, total} を返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
  assert.equal(typeof body.total, "number");
  assert.ok(body.items.length > 0);
});

test("GET /api/works/:id 存在しないIDは404 + apiErrorSchema形式", async () => {
  const app = buildApp();
  const res = await app.request("/api/works/NOT_EXIST");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
  assert.equal(typeof body.error.message, "string");
});

test("PATCH /api/works/:id でタグ更新が反映される", async () => {
  const app = buildApp();

  // 既存作品のIDを取得
  const listRes = await app.request("/api/works");
  const { items } = await listRes.json();
  const targetId: string = items[0].id;

  const patchRes = await app.request(`/api/works/${targetId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags: ["テスト用タグ"] }),
  });
  assert.equal(patchRes.status, 200);
  const patched = await patchRes.json();
  assert.deepEqual(patched.tags, ["テスト用タグ"]);

  // 再取得しても反映されている
  const getRes = await app.request(`/api/works/${targetId}`);
  const fetched = await getRes.json();
  assert.deepEqual(fetched.tags, ["テスト用タグ"]);
});

test("GET /api/axes/cv は AxisFacetItem[] を count 降順で返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/axes/cv");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body));
  assert.ok(body.length > 0);
  for (const item of body) {
    assert.equal(typeof item.value, "string");
    assert.equal(typeof item.count, "number");
  }
  for (let i = 1; i < body.length; i++) {
    assert.ok(body[i - 1].count >= body[i].count);
  }
});

test("GET /api/axes/:axis に不正な軸を渡すと400", async () => {
  const app = buildApp();
  const res = await app.request("/api/axes/invalid-axis");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("GET /api/fs はルートの listing を返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/fs");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(typeof body.path, "string");
  assert.ok(Array.isArray(body.entries));
});

test("POST /api/smart-folders は201 + 作成されたSmartFolderを返す", async () => {
  const app = buildApp();
  const res = await app.request("/api/smart-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "テストフォルダー", rules: [], sort: "added-desc" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.name, "テストフォルダー");
  assert.equal(typeof body.id, "string");
  assert.equal(typeof body.createdAt, "string");
});

test("未知ルートは404 + not_found", async () => {
  const app = buildApp();
  const res = await app.request("/api/unknown-route");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
});
