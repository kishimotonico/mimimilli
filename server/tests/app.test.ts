import { test } from "node:test";
import assert from "node:assert/strict";
import { compareJapaneseSortKeys } from "../src/core/japaneseSortKey.ts";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { resetDlsiteProgressStateForTest } from "../src/routes/dlsiteProgress.ts";

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

test("GET /api/works は複数の tags を配列で受け、タグ内のカンマを保持する", async () => {
  const adapter = createFixtureAdapter();
  let receivedTags: string[] | undefined;
  adapter.queryWorks = async (query) => {
    receivedTags = query.tags;
    return { items: [], total: 0 };
  };

  const app = createApp(adapter);
  const res = await app.request("/api/works?tags=tag%2Cone&tags=tag2");

  assert.equal(res.status, 200);
  assert.deepEqual(receivedTags, ["tag,one", "tag2"]);
});

test("GET /api/works/:id 存在しないIDは404 + apiErrorSchema形式", async () => {
  const app = buildApp();
  const res = await app.request("/api/works/NOT_EXIST");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
  assert.equal(typeof body.error.message, "string");
});

test("POST /api/dlsite/:id/fetch は取得分類をHTTPエラーコードへ反映する", async () => {
  for (const [kind, status] of [
    ["not_found", 404],
    ["parse_error", 502],
    ["error", 502],
  ] as const) {
    const adapter = createFixtureAdapter();
    adapter.dlsiteFetch = async () => ({ ok: false, kind, message: `${kind} message` });
    const res = await createApp(adapter).request("/api/dlsite/RJ000001/fetch", { method: "POST" });
    assert.equal(res.status, status);
    const body = await res.json();
    assert.equal(body.error.code, kind);
    assert.equal(body.error.message, `${kind} message`);
  }
});

test("DLsite一括取得は202で開始し、SSEに進捗と完了件数を配信する", async () => {
  resetDlsiteProgressStateForTest();
  const app = buildApp();
  const start = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  const events = await app.request("/api/dlsite/events");
  assert.equal(events.status, 200);
  const text = await events.text();
  assert.match(text, /event: complete/);
  assert.match(text, /"fetched":/);
  assert.match(text, /"failed":0/);
});

test("DELETE /api/dlsite/bulk は実行中ジョブの取消を要求し、終了済みには404", async () => {
  resetDlsiteProgressStateForTest();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = createFixtureAdapter();
  adapter.runDlsiteBulk = async (_mode, _workIds, options) => {
    await gate;
    options?.signal?.throwIfAborted();
    return { fetched: 0, failed: 0, skipped: 0 };
  };
  const app = createApp(adapter);
  const start = await app.request("/api/dlsite/bulk", { method: "POST" });
  assert.equal(start.status, 202);
  await new Promise((resolve) => setImmediate(resolve));
  const cancelling = await app.request("/api/dlsite/bulk", { method: "DELETE" });
  assert.equal(cancelling.status, 200);
  assert.deepEqual(await cancelling.json(), { cancelling: true });
  release();
  await new Promise((resolve) => setImmediate(resolve));
  const idle = await app.request("/api/dlsite/bulk", { method: "DELETE" });
  assert.equal(idle.status, 404);
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

test("GET /api/axes/:axis は未登録 prefix でも集計する（該当なしは空配列）", async () => {
  const app = buildApp();
  const res = await app.request("/api/axes/unknown-prefix");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), []);
});

test("GET /api/axes/:axis にスラッシュ入りの軸を渡すと400", async () => {
  const app = buildApp();
  const res = await app.request(`/api/axes/${encodeURIComponent("a/b")}`);
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

test("POST /api/smart-folders は未対応ルールを400で拒否する", async () => {
  const app = buildApp();
  const res = await app.request("/api/smart-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "不正ルール",
      rules: [{ conjunction: "WHERE", field: "不明", operator: "=", values: ["x"] }],
      sort: "added-desc",
    }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("スマートフォルダーの作品一覧は保存済み sort を適用する", async () => {
  const app = buildApp();
  const createRes = await app.request("/api/smart-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "タイトル降順", rules: [], sort: "title-desc" }),
  });
  const folder = await createRes.json();

  const worksRes = await app.request(`/api/smart-folders/${folder.id}/works`);
  assert.equal(worksRes.status, 200);
  const page = await worksRes.json();
  assert.equal(typeof page.total, "number");
  const titles = page.items.map((work: { title: string }) => work.title);
  const expected = [...titles].sort((a, b) => compareJapaneseSortKeys(b, a));
  assert.deepEqual(titles, expected);
});

test("randomソートのスマートフォルダーも作品一覧を返す", async () => {
  const app = buildApp();
  const createRes = await app.request("/api/smart-folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "ランダム", rules: [], sort: "random" }),
  });
  const folder = await createRes.json();

  const worksRes = await app.request(`/api/smart-folders/${folder.id}/works`);
  assert.equal(worksRes.status, 200);
  const page = await worksRes.json();
  assert.equal(typeof page.total, "number");
  assert.ok(page.items.length > 0);
  assert.equal(typeof page.seed, "number");
});

test("未知ルートは404 + not_found", async () => {
  const app = buildApp();
  const res = await app.request("/api/unknown-route");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
});
