// PUT /settings の検証契約。fixture/real 両アダプタで同じ形式チェックを通ることを確認する。
import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createTestRealAdapter } from "./helpers/realAdapter.ts";
import { createApp } from "../src/app.ts";
import { makeTestScope } from "./helpers/sampleLibrary.ts";

async function putSettings(app: ReturnType<typeof createApp>, rootFolder: string) {
  return app.request("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rootFolder }),
  });
}

test("fixtureアダプタ: 相対パスは400 invalid_requestになる", async () => {
  const app = createApp(createFixtureAdapter());
  const res = await putSettings(app, "not/an/absolute/path");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("fixtureアダプタ: 空文字は400 invalid_requestになる", async () => {
  const app = createApp(createFixtureAdapter());
  const res = await putSettings(app, "   ");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("fixtureアダプタ: 絶対パスは保存できる", async () => {
  const app = createApp(createFixtureAdapter());
  const res = await putSettings(app, "/library/new-root");
  assert.equal(res.status, 200);
  assert.equal((await res.json()).rootFolder, "/library/new-root");
});

test("realアダプタ: 相対パスは fixture と同じく400 invalid_requestになる", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const adapter = scope.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  const res = await putSettings(app, "not/an/absolute/path");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("realアダプタ: 存在しない絶対パスは400 invalid_requestになる", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const adapter = scope.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  const res = await putSettings(app, "/path/does/not/exist/for-mimimilli");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("realアダプタ: 存在するがディレクトリでないパスは400 invalid_requestになる", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const adapter = scope.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-settings-route-"));
  const filePath = join(dir, "not-a-directory.txt");
  writeFileSync(filePath, "x");
  const res = await putSettings(app, filePath);
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});

test("realアダプタ: 存在するディレクトリは保存できる", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const adapter = scope.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-settings-route-"));
  const res = await putSettings(app, dir);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).rootFolder, realpathSync(dir));
});
