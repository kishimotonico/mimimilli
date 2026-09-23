// ファイルモードからの手動作品登録 API の結合テスト。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import {
  META_FILE_NAME,
  emptyDlsiteState,
  sidecarMetaFileName,
  type MetaFile,
  workspacePath,
} from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { writeMetaFile } from "../../src/adapters/real/meta.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { folderMetaPath } from "../helpers/workTestUtils.ts";
import { nts } from "../helpers/tag.ts";
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

function workspace(root: string, absolutePath: string) {
  return workspacePath(absolutePath.slice(root.length + 1));
}

async function setupPlainLibrary(t: TestContext) {
  const directory = makeTestDirectory("work-register");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const parent = join(root, "RJ900010_parent");
  mkdirSync(parent, { recursive: true });
  writeWav(join(parent, "intro.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
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

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const childRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, child), title: "子作品" }),
  });
  assert.equal(childRes.status, 201);
  const childWork = await childRes.json();

  return { adapter, app, root, parent, child, sibling, childWork };
}

async function setupLibraryWithTwoChildren(t: TestContext) {
  const directory = makeTestDirectory("work-register-two-children");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const parent = join(root, "RJ900010_parent");
  const childA = join(parent, "RJ900011_child_a");
  const childB = join(parent, "RJ900012_child_b");
  mkdirSync(join(childA, "tracks"), { recursive: true });
  mkdirSync(join(childB, "tracks"), { recursive: true });
  writeWav(join(parent, "intro.wav"), 1);
  writeWav(join(childA, "tracks", "01.wav"), 2);
  writeWav(join(childB, "tracks", "01.wav"), 2);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const childARes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, childA), title: "子作品A" }),
  });
  assert.equal(childARes.status, 201);
  const childAWork = await childARes.json();

  const childBRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, childB), title: "子作品B" }),
  });
  assert.equal(childBRes.status, 201);
  const childBWork = await childBRes.json();

  return { adapter, app, root, parent, childA, childB, childAWork, childBWork };
}

test("POST /works: 未登録フォルダーを作品として登録できる", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const before = snapshotFiles(parent, true);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親作品タイトル" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.title, "親作品タイトル");
  assert.equal(body.snapshot.physicalPath, parent);
  assert.equal(body.projection.status, "published");
  assert.ok(existsSync(join(parent, META_FILE_NAME)));

  const after = snapshotFiles(parent, true);
  assert.deepEqual(after, before);
});

test("POST /works: 既に登録済みのフォルダへ再実行すると 409 (already_registered)", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);

  const first = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "初回登録" }),
  });
  assert.equal(first.status, 201);

  const second = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "再登録" }),
  });
  assert.equal(second.status, 409);
  const body = await second.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /既に.*登録/);
});

test("POST /works: 絶対パスとパストラバーサルを拒否する", async (t) => {
  const directory = makeTestDirectory("work-register-outside");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  for (const path of [join(directory.path, "outside"), "../outside"]) {
    const res = await app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, title: "外" }),
    });
    assert.equal(res.status, 400);
  }
});

test("POST /works: 配下に子作品がある親の登録は拒否し、子を解除すれば親を登録できる", async (t) => {
  const { app, root, parent, child, childWork } = await setupLibraryWithChild(t);
  assert.ok(existsSync(folderMetaPath(child)));

  const conflict = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親作品" }),
  });
  assert.equal(conflict.status, 409);
  const conflictBody = await conflict.json();
  assert.equal(conflictBody.error.code, "conflict");
  assert.match(conflictBody.error.message, /配下に登録済み作品が1件あります/);

  const preview = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, parent))}`,
  );
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.equal(previewBody.descendantWorkCount, 1);

  const childRes = await app.request(`/api/works/${childWork.snapshot.id}`);
  assert.equal(childRes.status, 200);
  assert.ok(existsSync(folderMetaPath(child)));
  assert.ok(!existsSync(join(parent, META_FILE_NAME)));

  const deleted = await app.request(`/api/works/${childWork.snapshot.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 204);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親作品" }),
  });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).snapshot.title, "親作品");
  assert.ok(existsSync(join(parent, META_FILE_NAME)));
});

test("POST /works: 登録前後で音声等の物理ファイルは変更されない", async (t) => {
  const directory = makeTestDirectory("work-register-physical");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folder = join(root, "plain_folder");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 3);
  writeFileSync(join(folder, "notes.txt"), "memo");

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const before = snapshotFiles(root, true);
  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, folder), title: "プレーン" }),
  });
  assert.equal(res.status, 201);

  const after = snapshotFiles(root, true);
  assert.deepEqual(after, before);
  assert.ok(existsSync(join(folder, META_FILE_NAME)));
});

test("POST /works: フォームで入力したタグを登録する", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
      title: "タグ付き作品",
      tags: ["voice", "ASMR"],
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.deepEqual(body.snapshot.tags, ["voice", "ASMR"]);
});

test("GET /works/register-preview: RJコードをフォルダ名から検出する", async (t) => {
  const { app, root, sibling } = await setupLibraryWithChild(t);
  const res = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, sibling))}`,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.detectedRjCode, "RJ900012");
  assert.equal(body.suggestedTitle, "RJ900012_sibling");
});

function writeOrphanedMeta(folder: string, id: string, title: string): void {
  writeMetaFile(join(folder, META_FILE_NAME), {
    formatVersion: 1,
    id,
    title,
    urls: [],
    tags: nts(["orphaned-tag"]),
    coverImage: null,
    playlists: [],
    defaultPlaylistId: null,
    createdAt: new Date().toISOString(),
    dlsite: emptyDlsiteState(),
  });
}

test("GET /works/register-preview: 孤立メタは orphanedMeta とメタの title を返す", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const orphanedId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  writeOrphanedMeta(parent, orphanedId, "孤立メタのタイトル");

  const res = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, parent))}`,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.orphanedMeta, true);
  assert.equal(body.alreadyRegistered, false);
  assert.equal(body.suggestedTitle, "孤立メタのタイトル");
});

test("POST /works: 孤立メタを復元登録し id を保持する", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const orphanedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "復元後タイトル" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.id, orphanedId);
  assert.equal(body.snapshot.title, "復元後タイトル");
  assert.equal(body.snapshot.physicalPath, parent);
  assert.equal(body.projection.status, "published");

  const get = await app.request(`/api/works/${orphanedId}`);
  assert.equal(get.status, 200);
});

test("GET /works/register-preview: 孤立メタの tags を返す", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const orphanedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, parent))}`,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.tags, ["orphaned-tag"]);
});

test("POST /works: 孤立メタ復元時、フォームで編集したタグを反映する", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const orphanedId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  writeOrphanedMeta(parent, orphanedId, "復元前タイトル");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
      title: "復元後タイトル",
      tags: ["new-tag"],
    }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.id, orphanedId);
  assert.deepEqual(body.snapshot.tags, ["new-tag"]);

  const get = await app.request(`/api/works/${orphanedId}`);
  assert.equal(get.status, 200);
  assert.deepEqual((await get.json()).tags, ["new-tag"]);
});

test("POST /works: 孤立メタ復元でDLsite URLの選択外は保持し、選択時だけ置換する", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const orphanedId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const orphanedMeta: MetaFile & { customTopLevel: string } = {
    formatVersion: 1,
    id: orphanedId,
    title: "復元前タイトル",
    urls: [
      { label: "公式", url: "https://example.test/work" },
      { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ000001.html" },
    ],
    tags: nts(["orphaned-tag"]),
    coverImage: null,
    playlists: [],
    defaultPlaylistId: null,
    createdAt: new Date().toISOString(),
    dlsite: emptyDlsiteState(),
    customTopLevel: "preserved",
  };
  writeMetaFile(join(parent, META_FILE_NAME), orphanedMeta);

  const restore = async (folder: string, applyUrl: boolean) =>
    app.request("/api/works", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: workspace(root, folder),
        title: "復元後タイトル",
        dlsite: {
          info: {
            rjCode: "RJ900020",
            title: "DLsiteタイトル",
            circle: null,
            cvs: [],
            genreTags: [],
            ageRating: null,
            coverUrl: null,
            url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900020.html",
          },
          applyTitle: false,
          applyTags: [],
          applyCover: false,
          applyUrl,
        },
      }),
    });

  const preserved = await restore(parent, false);
  assert.equal(preserved.status, 201);
  let meta = JSON.parse(readFileSync(join(parent, META_FILE_NAME), "utf-8")) as {
    urls: Array<{ label: string; url: string }>;
    customTopLevel: string;
  };
  assert.deepEqual(meta.urls, [
    { label: "公式", url: "https://example.test/work" },
    { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ000001.html" },
  ]);
  assert.equal(meta.customTopLevel, "preserved");

  const replacementFolder = join(root, "orphan-url-replace");
  mkdirSync(replacementFolder);
  writeWav(join(replacementFolder, "track.wav"), 1);
  writeMetaFile(join(replacementFolder, META_FILE_NAME), {
    formatVersion: 1,
    id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    title: "復元前タイトル",
    urls: meta.urls,
    tags: nts(["orphaned-tag"]),
    coverImage: null,
    playlists: [],
    defaultPlaylistId: null,
    createdAt: new Date().toISOString(),
    dlsite: emptyDlsiteState(),
  });
  const replaced = await restore(replacementFolder, true);
  assert.equal(replaced.status, 201);
  meta = JSON.parse(readFileSync(join(replacementFolder, META_FILE_NAME), "utf-8")) as typeof meta;
  assert.deepEqual(meta.urls, [
    { label: "公式", url: "https://example.test/work" },
    { label: "DLsite", url: "https://www.dlsite.com/maniax/work/=/product_id/RJ900020.html" },
  ]);
});

test("POST /works: 壊れた孤立メタは invalid_meta エラー", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  writeFileSync(join(parent, META_FILE_NAME), '{"id":"not-uuid","title":""}');

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "復元試行" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /メタファイルが不正なため復元できません/);
});

test("POST /works: 孤立メタが不正でも子がある親の登録は拒否し子は残る", async (t) => {
  const { app, root, parent, child, childWork } = await setupLibraryWithChild(t);
  writeFileSync(join(parent, META_FILE_NAME), '{"id":"not-uuid","title":""}');
  assert.ok(existsSync(folderMetaPath(child)));

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
      title: "親作品",
    }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /配下に登録済み作品が1件あります/);

  const childRes = await app.request(`/api/works/${childWork.snapshot.id}`);
  assert.equal(childRes.status, 200);
  const childBody = await childRes.json();
  assert.equal(childBody.physicalPath, child);
  assert.ok(existsSync(folderMetaPath(child)));
});

test("POST /works: 別パスのライブ作品と同一IDの孤立メタ復元は拒否し既存作品は不変", async (t) => {
  const { app, root, sibling } = await setupLibraryWithChild(t);

  const siblingRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, sibling), title: "既存作品" }),
  });
  assert.equal(siblingRes.status, 201);
  const createdSibling = await siblingRes.json();
  const existingWork = await (await app.request(`/api/works/${createdSibling.snapshot.id}`)).json();
  const playlistId = existingWork.playlists[0]?.id as string;
  const trackId = existingWork.playlists[0]?.tracks[0]?.id as string;
  assert.ok(playlistId);
  assert.ok(trackId);

  const lastPlayedRes = await app.request(`/api/works/${existingWork.id}/last-played`, {
    method: "POST",
  });
  assert.equal(lastPlayedRes.status, 204);
  const beforeExisting = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.ok(beforeExisting.lastPlayedAt);

  const orphanDir = join(root, "RJ900013_orphan");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  writeFileSync(
    join(orphanDir, META_FILE_NAME),
    JSON.stringify(
      {
        formatVersion: 1,
        id: existingWork.id,
        title: "孤立メタ作品",
        urls: [],
        tags: [],
        coverImage: null,
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "t", file: "track.wav", start: 0 }],
          },
        ],
        defaultPlaylistId: playlistId,
        createdAt: new Date().toISOString(),
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    ) + "\n",
  );

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, orphanDir), title: "復元後タイトル" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /同じ Work ID が別の場所で登録済みです/);

  const afterExisting = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.equal(afterExisting.id, existingWork.id);
  assert.equal(afterExisting.physicalPath, sibling);
  assert.equal(afterExisting.title, "既存作品");
  assert.equal(afterExisting.lastPlayedAt, beforeExisting.lastPlayedAt);
  assert.equal(afterExisting.playlists[0]?.id, playlistId);
  assert.equal(afterExisting.playlists[0]?.tracks[0]?.id, trackId);

  const orphanMeta = JSON.parse(readFileSync(join(orphanDir, META_FILE_NAME), "utf-8")) as {
    id: string;
    playlists: Array<{ id: string; tracks: Array<{ id: string }> }>;
  };
  assert.equal(orphanMeta.id, existingWork.id);
  assert.equal(orphanMeta.playlists[0]?.id, playlistId);
  assert.equal(orphanMeta.playlists[0]?.tracks[0]?.id, trackId);
});

test("POST /works: missing の同一IDを別パスから復元すると再接続し履歴を保持する", async (t) => {
  const { app, adapter, root, sibling } = await setupLibraryWithChild(t);

  const siblingRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, sibling), title: "移動前作品" }),
  });
  assert.equal(siblingRes.status, 201);
  const existingWork = (await siblingRes.json()).snapshot;

  const lastPlayedRes = await app.request(`/api/works/${existingWork.id}/last-played`, {
    method: "POST",
  });
  assert.equal(lastPlayedRes.status, 204);
  const before = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.ok(before.lastPlayedAt);

  rmSync(sibling, { recursive: true, force: true });
  await adapter.scan();
  const missing = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.equal(missing.status, "missing");

  const movedDir = join(root, "RJ900013_moved");
  mkdirSync(movedDir, { recursive: true });
  writeWav(join(movedDir, "track.wav"), 2);
  writeOrphanedMeta(movedDir, existingWork.id, "移動後タイトル");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, movedDir), title: "再接続タイトル" }),
  });
  assert.equal(res.status, 201);
  const restoredBody = await res.json();
  assert.equal(restoredBody.snapshot.id, existingWork.id);
  assert.equal(restoredBody.snapshot.physicalPath, movedDir);
  assert.equal(restoredBody.snapshot.title, "再接続タイトル");
  const restored = await (await app.request(`/api/works/${restoredBody.snapshot.id}`)).json();
  assert.equal(restored.lastPlayedAt, before.lastPlayedAt);
});

test("POST /works: 孤立メタ復元時もスキーマ外フィールドを保持する", async (t) => {
  const { app, root } = await setupLibraryWithChild(t);

  const orphanDir = join(root, "RJ900014_orphan_extra");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  const orphanedId = "33333333-3333-4333-8333-333333333333";
  const playlistId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const trackId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  writeFileSync(
    join(orphanDir, META_FILE_NAME),
    JSON.stringify(
      {
        formatVersion: 1,
        id: orphanedId,
        title: "孤立メタ作品",
        urls: [],
        tags: [],
        coverImage: null,
        playlists: [
          {
            id: playlistId,
            name: "default",
            customPlaylistField: "playlist-extra",
            tracks: [
              {
                id: trackId,
                title: "t",
                file: "track.wav",
                start: 0,
                customTrackField: "track-extra",
              },
            ],
          },
        ],
        defaultPlaylistId: playlistId,
        createdAt: new Date().toISOString(),
        dlsite: emptyDlsiteState(),
        customTopLevel: "top-extra",
      },
      null,
      2,
    ) + "\n",
  );

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, orphanDir), title: "復元後タイトル" }),
  });
  assert.equal(res.status, 201);
  const restored = (await res.json()).snapshot;
  assert.equal(restored.id, orphanedId);

  const restoredMeta = JSON.parse(readFileSync(join(orphanDir, META_FILE_NAME), "utf-8")) as {
    id: string;
    customTopLevel: string;
    playlists: Array<{
      id: string;
      customPlaylistField: string;
      tracks: Array<{ id: string; customTrackField: string }>;
    }>;
  };
  assert.equal(restoredMeta.id, restored.id);
  assert.equal(restoredMeta.customTopLevel, "top-extra");
  assert.equal(restoredMeta.playlists[0]?.customPlaylistField, "playlist-extra");
  assert.equal(restoredMeta.playlists[0]?.tracks[0]?.customTrackField, "track-extra");
  assert.equal(restoredMeta.playlists[0]?.id, playlistId);
  assert.equal(restoredMeta.playlists[0]?.tracks[0]?.id, trackId);
});

test("POST /works: 配下に子が2件ある親の登録は拒否し両方残る", async (t) => {
  const { adapter, app, root, parent, childA, childB, childAWork, childBWork } =
    await setupLibraryWithTwoChildren(t);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親作品" }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /配下に登録済み作品が2件あります/);

  assert.ok(await adapter.getWork(childAWork.snapshot.id));
  assert.ok(await adapter.getWork(childBWork.snapshot.id));
  assert.ok(existsSync(folderMetaPath(childA)));
  assert.ok(existsSync(folderMetaPath(childB)));

  const preview = await adapter.getWorkRegisterPreview(workspace(root, parent));
  assert.equal(preview?.alreadyRegistered, false);
  assert.equal(preview?.descendantWorkCount, 2);
});

test("POST /works: 孤立メタ復元時も defaultPlaylist キーを保持する", async (t) => {
  const { app, root } = await setupLibraryWithChild(t);

  const orphanDir = join(root, "RJ900015_orphan_default_playlist");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  const orphanedId = "44444444-4444-4444-8444-444444444444";
  const playlistId = "11111111-1111-4111-8111-111111111111";
  const trackId = "22222222-2222-4222-8222-222222222222";
  writeFileSync(
    join(orphanDir, META_FILE_NAME),
    JSON.stringify(
      {
        formatVersion: 1,
        id: orphanedId,
        title: "孤立メタ作品",
        urls: [],
        tags: [],
        coverImage: null,
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "t", file: "track.wav", start: 0 }],
          },
        ],
        defaultPlaylist: "default",
        defaultPlaylistId: playlistId,
        createdAt: new Date().toISOString(),
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    ) + "\n",
  );

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, orphanDir), title: "復元後タイトル" }),
  });
  assert.equal(res.status, 201);
  const restored = (await res.json()).snapshot;
  assert.equal(restored.id, orphanedId);

  const restoredMeta = JSON.parse(readFileSync(join(orphanDir, META_FILE_NAME), "utf-8")) as {
    id: string;
    defaultPlaylist: string;
    defaultPlaylistId: string;
  };
  assert.equal(restoredMeta.id, restored.id);
  assert.equal(restoredMeta.defaultPlaylist, "default");
  assert.equal(restoredMeta.defaultPlaylistId, playlistId);
});

async function setupFileLibrary(t: TestContext) {
  const directory = makeTestDirectory("work-register-file");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const fanza = join(root, "fanza");
  mkdirSync(fanza, { recursive: true });
  const audio = join(fanza, "d00001.wav");
  writeWav(audio, 2);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  return { app, adapter, root, fanza, audio };
}

test("GET /works/register-preview: 単一音声ファイルのタイトル候補を返す", async (t) => {
  const { app, root, audio } = await setupFileLibrary(t);
  const res = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, audio))}`,
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.suggestedTitle, "d00001");
  assert.equal(body.descendantWorkCount, 0);
  assert.equal(body.alreadyRegistered, false);
  assert.equal(body.orphanedMeta, false);
});

test("POST /works: 未登録の音声ファイルを単一ファイル作品として登録できる", async (t) => {
  const { app, root, fanza, audio } = await setupFileLibrary(t);
  const before = snapshotFiles(fanza, true);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, audio), title: "単一ファイル作品" }),
  });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.snapshot.title, "単一ファイル作品");
  assert.equal(body.snapshot.physicalPath, audio);
  assert.equal(body.projection.status, "published");
  const workRes = await app.request(`/api/works/${body.snapshot.id}`);
  assert.equal(workRes.status, 200);
  const workBody = await workRes.json();
  assert.equal(workBody.playlists.length, 1);
  assert.equal(workBody.playlists[0].tracks.length, 1);
  const track = workBody.playlists[0].tracks[0];
  assert.equal(track.file, "d00001.wav");
  assert.equal(track.title, "d00001");
  assert.equal(track.start, undefined);
  assert.equal(track.end, undefined);

  const sidecar = join(fanza, sidecarMetaFileName("d00001.wav"));
  assert.ok(existsSync(sidecar));
  const meta = JSON.parse(readFileSync(sidecar, "utf-8")) as MetaFile;
  assert.equal(meta.id, body.snapshot.id);
  assert.equal(meta.coverImage, null);
  assert.equal(meta.playlists[0]?.tracks[0]?.file, "d00001.wav");
  assert.equal(meta.playlists[0]?.tracks[0]?.start, undefined);
  assert.equal(meta.playlists[0]?.tracks[0]?.end, undefined);

  const listing = await app.request(`/api/fs?path=${encodeURIComponent("fanza")}`);
  assert.equal(listing.status, 200);
  const fsBody = await listing.json();
  const fileEntry = fsBody.entries.find((entry: { name: string }) => entry.name === "d00001.wav");
  assert.equal(fileEntry?.workId, body.snapshot.id);
  assert.equal(fileEntry?.workRelPath, "");
  assert.ok(
    !fsBody.entries.some((entry: { name: string }) => entry.name.endsWith(".mimimilli.json")),
  );

  const after = snapshotFiles(fanza, true);
  assert.deepEqual(after, before);
});

test("POST /works: 既に登録済みの音声ファイルへ再実行すると 409 (already_registered)", async (t) => {
  const { app, root, audio } = await setupFileLibrary(t);
  const first = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, audio), title: "単一ファイル作品" }),
  });
  assert.equal(first.status, 201);

  const second = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, audio), title: "再登録" }),
  });
  assert.equal(second.status, 409);

  const preview = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, audio))}`,
  );
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).alreadyRegistered, true);
});

test("POST /works: 登録済みフォルダー配下の音声ファイルは 409", async (t) => {
  const { app, root, parent } = await setupPlainLibrary(t);
  const folderRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親作品" }),
  });
  assert.equal(folderRes.status, 201);

  const fileRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, join(parent, "intro.wav")),
      title: "ファイル登録",
    }),
  });
  assert.equal(fileRes.status, 409);
});

test("GET /works/register-preview: 非音声ファイルは 404", async (t) => {
  const { app, root, fanza } = await setupFileLibrary(t);
  const notes = join(fanza, "notes.txt");
  writeFileSync(notes, "memo");
  const preview = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, notes))}`,
  );
  assert.equal(preview.status, 404);

  const created = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, notes), title: "メモ" }),
  });
  assert.equal(created.status, 404);
});

test("DELETE /works: 単一ファイル作品の解除はサイドカーだけ消し音声は残す", async (t) => {
  const { app, root, fanza, audio } = await setupFileLibrary(t);
  const created = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, audio), title: "単一ファイル作品" }),
  });
  assert.equal(created.status, 201);
  const work = await created.json();
  const sidecar = join(fanza, sidecarMetaFileName("d00001.wav"));
  assert.ok(existsSync(sidecar));

  const deleted = await app.request(`/api/works/${work.snapshot.id}`, { method: "DELETE" });
  assert.equal(deleted.status, 204);
  assert.ok(!existsSync(sidecar));
  assert.ok(existsSync(audio));
});
