// ファイルモードからの手動作品登録 API の結合テスト。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { META_FILE_NAME, emptyDlsiteState } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { writeMetaFile } from "../../src/adapters/real/meta.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { folderMetaPath } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

interface FileSnapshot {
  path: string;
  size: number;
  hash: string;
}

function snapshotFiles(root: string, excludeMeta = false): FileSnapshot[] {
  const out: FileSnapshot[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (excludeMeta && (name === META_FILE_NAME || name.endsWith(".mimimilli.json"))) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else {
        const body = readFileSync(full);
        out.push({
          path: full,
          size: stat.size,
          hash: createHash("sha256").update(body).digest("hex"),
        });
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function setupPlainLibrary(t: TestContext) {
  const directory = makeTestDirectory("work-register");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const parent = join(root, "RJ900010_parent");
  mkdirSync(parent, { recursive: true });
  writeWav(join(parent, "intro.wav"), 1);

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  return { app, root, parent };
}

async function setupLibraryWithChild(t: TestContext) {
  const directory = makeTestDirectory("work-register-child");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const parent = join(root, "RJ900010_parent");
  const child = join(parent, "RJ900011_child");
  const sibling = join(root, "RJ900012_sibling");
  mkdirSync(join(child, "tracks"), { recursive: true });
  mkdirSync(join(sibling, "tracks"), { recursive: true });
  writeWav(join(parent, "intro.wav"), 1);
  writeWav(join(child, "tracks", "01.wav"), 2);
  writeWav(join(sibling, "tracks", "01.wav"), 2);

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const childRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: child, title: "子作品" }),
  });
  assert.equal(childRes.status, 201);
  const childWork = await childRes.json();

  return { app, root, parent, child, sibling, childWork };
}

test("POST /works: 未登録フォルダーを作品として登録できる", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  const before = snapshotFiles(parent, true);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "親作品タイトル" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.title, "親作品タイトル");
  assert.equal(body.physicalPath, parent);
  assert.ok(existsSync(join(parent, META_FILE_NAME)));

  const after = snapshotFiles(parent, true);
  assert.deepEqual(after, before);
});

test("POST /works: 既に登録済みのフォルダへ再実行すると 409 (already_registered)", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);

  const first = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "初回登録" }),
  });
  assert.equal(first.status, 201);

  const second = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "再登録" }),
  });
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /既に.*登録/);
});

test("POST /works: スキャンルート外のパスは 404", async (t) => {
  const directory = makeTestDirectory("work-register-outside");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });
  const outside = join(directory.path, "outside");
  mkdirSync(outside, { recursive: true });

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: outside, title: "外" }),
  });
  assert.equal(res.status, 404);
});

test("POST /works: 配下の子作品を統合して親を登録する", async (t) => {
  const { app, parent, child, childWork } = await setupLibraryWithChild(t);
  assert.ok(existsSync(folderMetaPath(child)));

  const conflict = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "親に統合" }),
  });
  assert.equal(conflict.status, 409);

  const preview = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(parent)}`,
  );
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.equal(previewBody.descendantWorkCount, 1);

  const before = snapshotFiles(parent, true);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: parent,
      title: "親に統合",
      mergeDescendantWorks: true,
    }),
  });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).title, "親に統合");
  assert.ok(!existsSync(folderMetaPath(child)));

  const gone = await app.request(`/api/works/${childWork.id}`);
  assert.equal(gone.status, 404);

  assert.ok(existsSync(join(parent, META_FILE_NAME)));

  const after = snapshotFiles(parent, true);
  assert.deepEqual(after, before);
});

test("POST /works: 登録前後で音声等の物理ファイルは変更されない", async (t) => {
  const directory = makeTestDirectory("work-register-physical");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folder = join(root, "plain_folder");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 3);
  writeFileSync(join(folder, "notes.txt"), "memo");

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const before = snapshotFiles(root, true);
  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "プレーン" }),
  });
  assert.equal(res.status, 201);

  const after = snapshotFiles(root, true);
  assert.deepEqual(after, before);
  assert.ok(existsSync(join(folder, META_FILE_NAME)));
});

test("POST /works: フォームで入力したタグを登録する", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "タグ付き作品", tags: ["voice", "ASMR"] }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual(body.tags, ["voice", "ASMR"]);
});

test("GET /works/register-preview: RJコードをフォルダ名から検出する", async (t) => {
  const { app, sibling } = await setupLibraryWithChild(t);
  const res = await app.request(`/api/works/register-preview?path=${encodeURIComponent(sibling)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.detectedRjCode, "RJ900012");
  assert.equal(body.suggestedTitle, "RJ900012_sibling");
});

test("POST /works: DLsiteカバー適用失敗時は子作品を削除しない", async (t) => {
  const { app, parent, childWork } = await setupLibraryWithChild(t);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: parent,
      title: "親に統合",
      mergeDescendantWorks: true,
      dlsite: {
        info: {
          rjCode: "RJ900010",
          title: "DLsiteタイトル",
          coverUrl: "https://invalid.example.test/cover.jpg",
          url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900010.html",
        },
        applyTitle: false,
        applyTags: [],
        applyCover: true,
      },
    }),
  });
  assert.notEqual(res.status, 201);

  const child = await app.request(`/api/works/${childWork.id}`);
  assert.equal(child.status, 200);
});

function writeOrphanedMeta(folder: string, id: string, title: string): void {
  writeMetaFile(join(folder, META_FILE_NAME), {
    id,
    title,
    urls: [],
    tags: ["orphaned-tag"],
    coverImage: null,
    playlists: [],
    defaultPlaylistId: null,
    createdAt: new Date().toISOString(),
    dlsite: emptyDlsiteState(),
  });
}

test("GET /works/register-preview: 孤立メタは orphanedMeta とメタの title を返す", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  const orphanedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  writeOrphanedMeta(parent, orphanedId, "孤立メタのタイトル");

  const res = await app.request(`/api/works/register-preview?path=${encodeURIComponent(parent)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.orphanedMeta, true);
  assert.equal(body.alreadyRegistered, false);
  assert.equal(body.suggestedTitle, "孤立メタのタイトル");
});

test("POST /works: 孤立メタを復元登録し id を保持する", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  const orphanedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "復元後タイトル" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.id, orphanedId);
  assert.equal(body.title, "復元後タイトル");
  assert.equal(body.physicalPath, parent);

  const get = await app.request(`/api/works/${orphanedId}`);
  assert.equal(get.status, 200);
});

test("GET /works/register-preview: 孤立メタの tags を返す", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  const orphanedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request(`/api/works/register-preview?path=${encodeURIComponent(parent)}`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tags, ["orphaned-tag"]);
});

test("POST /works: 孤立メタ復元時、フォームで編集したタグを反映する", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  const orphanedId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "復元後タイトル", tags: ["new-tag"] }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.id, orphanedId);
  assert.deepEqual(body.tags, ["new-tag"]);

  const get = await app.request(`/api/works/${orphanedId}`);
  assert.equal(get.status, 200);
  assert.deepEqual((await get.json()).tags, ["new-tag"]);
});

test("POST /works: 壊れた孤立メタは invalid_meta エラー", async (t) => {
  const { app, parent } = await setupPlainLibrary(t);
  writeFileSync(join(parent, META_FILE_NAME), '{"id":"not-uuid","title":""}');

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: parent, title: "復元試行" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /メタファイルが不正なため復元できません/);
});
