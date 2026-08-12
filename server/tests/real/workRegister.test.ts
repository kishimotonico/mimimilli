// ファイルモードからの手動作品登録 API の結合テスト。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { META_FILE_NAME, emptyDlsiteState, workspacePath } from "@mimimilli/shared";
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
    body: JSON.stringify({ path: workspace(root, child), title: "子作品" }),
  });
  assert.equal(childRes.status, 201);
  const childWork = await childRes.json();

  return { app, root, parent, child, sibling, childWork };
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

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
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
  assert.equal(body.title, "親作品タイトル");
  assert.equal(body.physicalPath, parent);
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

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
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

test("POST /works: 配下の子作品を統合して親を登録する", async (t) => {
  const { app, root, parent, child, childWork } = await setupLibraryWithChild(t);
  assert.ok(existsSync(folderMetaPath(child)));

  const conflict = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, parent), title: "親に統合" }),
  });
  assert.equal(conflict.status, 409);

  const preview = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(workspace(root, parent))}`,
  );
  assert.equal(preview.status, 200);
  const previewBody = await preview.json();
  assert.equal(previewBody.descendantWorkCount, 1);

  const before = snapshotFiles(parent, true);

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
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
  assert.deepEqual(body.tags, ["voice", "ASMR"]);
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

test("POST /works: DLsiteカバー適用失敗時は子作品を削除しない", async (t) => {
  const { app, root, parent, child, childWork } = await setupLibraryWithChild(t);
  assert.ok(existsSync(folderMetaPath(child)));

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
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

  const childRes = await app.request(`/api/works/${childWork.id}`);
  assert.equal(childRes.status, 200);
  const childBody = await childRes.json();
  assert.equal(childBody.physicalPath, child);
  assert.ok(existsSync(folderMetaPath(child)));
});

function writeOrphanedMeta(folder: string, id: string, title: string): void {
  writeMetaFile(join(folder, META_FILE_NAME), {
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
  assert.equal(body.id, orphanedId);
  assert.equal(body.title, "復元後タイトル");
  assert.equal(body.physicalPath, parent);

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
  assert.equal(body.id, orphanedId);
  assert.deepEqual(body.tags, ["new-tag"]);

  const get = await app.request(`/api/works/${orphanedId}`);
  assert.equal(get.status, 200);
  assert.deepEqual((await get.json()).tags, ["new-tag"]);
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

test("POST /works: 孤立メタが不正でも mergeDescendantWorks 時は子作品を削除しない", async (t) => {
  const { app, root, parent, child, childWork } = await setupLibraryWithChild(t);
  writeFileSync(join(parent, META_FILE_NAME), '{"id":"not-uuid","title":""}');
  assert.ok(existsSync(folderMetaPath(child)));

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: workspace(root, parent),
      title: "親に統合",
      mergeDescendantWorks: true,
    }),
  });
  assert.equal(res.status, 409);
  const body = await res.json();
  assert.equal(body.error.code, "conflict");
  assert.match(body.error.message, /メタファイルが不正なため復元できません/);

  const childRes = await app.request(`/api/works/${childWork.id}`);
  assert.equal(childRes.status, 200);
  const childBody = await childRes.json();
  assert.equal(childBody.physicalPath, child);
  assert.ok(existsSync(folderMetaPath(child)));
});

test("POST /works: 別パスの既存作品と同一IDの孤立メタを復元すると新IDで登録し既存作品は不変", async (t) => {
  const { app, root, sibling } = await setupLibraryWithChild(t);

  const siblingRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, sibling), title: "既存作品" }),
  });
  assert.equal(siblingRes.status, 201);
  const existingWork = await siblingRes.json();

  const lastPlayedRes = await app.request(`/api/works/${existingWork.id}/last-played`, {
    method: "POST",
  });
  assert.equal(lastPlayedRes.status, 204);
  const beforeExisting = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.ok(beforeExisting.lastPlayedAt);

  const orphanDir = join(root, "RJ900013_orphan");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  writeOrphanedMeta(orphanDir, existingWork.id, "孤立メタ作品");

  const res = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, orphanDir), title: "復元後タイトル" }),
  });
  assert.equal(res.status, 201);
  const restored = await res.json();
  assert.notEqual(restored.id, existingWork.id);
  assert.equal(restored.physicalPath, orphanDir);
  assert.equal(restored.title, "復元後タイトル");

  const afterExisting = await (await app.request(`/api/works/${existingWork.id}`)).json();
  assert.equal(afterExisting.id, existingWork.id);
  assert.equal(afterExisting.physicalPath, sibling);
  assert.equal(afterExisting.title, "既存作品");
  assert.equal(afterExisting.lastPlayedAt, beforeExisting.lastPlayedAt);

  const restoredMeta = JSON.parse(readFileSync(join(orphanDir, META_FILE_NAME), "utf-8")) as {
    id: string;
  };
  assert.equal(restoredMeta.id, restored.id);
});

test("POST /works: ID衝突復元時もスキーマ外フィールドを保持する", async (t) => {
  const { app, root, sibling } = await setupLibraryWithChild(t);

  const siblingRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, sibling), title: "既存作品" }),
  });
  assert.equal(siblingRes.status, 201);
  const existingWork = await siblingRes.json();

  const orphanDir = join(root, "RJ900014_orphan_extra");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  const playlistId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const trackId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
  writeFileSync(
    join(orphanDir, META_FILE_NAME),
    JSON.stringify(
      {
        id: existingWork.id,
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
  const restored = await res.json();
  assert.notEqual(restored.id, existingWork.id);

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
  assert.notEqual(restoredMeta.playlists[0]?.id, playlistId);
  assert.notEqual(restoredMeta.playlists[0]?.tracks[0]?.id, trackId);
});

test("POST /works: 1番目の子のメタ削除が失敗しても2番目の子は解除されエラーに残存IDが含まれる", async (t) => {
  const { adapter, root, parent, childA, childB, childAWork, childBWork } =
    await setupLibraryWithTwoChildren(t);

  chmodSync(childA, 0o555);
  t.after(() => {
    chmodSync(childA, 0o755);
  });

  await assert.rejects(
    () =>
      adapter.createWork({
        path: workspacePath(parent.slice(root.length + 1)),
        title: "親に統合",
        tags: [],
        mergeDescendantWorks: true,
      }),
    (error: Error) => {
      assert.match(error.message, /残存した子作品ID/);
      assert.ok(error.message.includes(childAWork.id));
      return true;
    },
  );

  const childAWorkAfter = await adapter.getWork(childAWork.id);
  assert.ok(childAWorkAfter);

  const childBWorkAfter = await adapter.getWork(childBWork.id);
  assert.equal(childBWorkAfter, null);
  assert.ok(!existsSync(folderMetaPath(childB)));

  const preview = await adapter.getWorkRegisterPreview(workspace(root, parent));
  assert.equal(preview?.alreadyRegistered, true);
});

test("POST /works: ID衝突復元時も defaultPlaylist キーを保持する", async (t) => {
  const { app, root, sibling } = await setupLibraryWithChild(t);

  const siblingRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspace(root, sibling), title: "既存作品" }),
  });
  assert.equal(siblingRes.status, 201);
  const existingWork = await siblingRes.json();

  const orphanDir = join(root, "RJ900015_orphan_default_playlist");
  mkdirSync(orphanDir, { recursive: true });
  writeWav(join(orphanDir, "track.wav"), 2);
  const playlistId = "11111111-1111-4111-8111-111111111111";
  const trackId = "22222222-2222-4222-8222-222222222222";
  writeFileSync(
    join(orphanDir, META_FILE_NAME),
    JSON.stringify(
      {
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
  const restored = await res.json();
  assert.notEqual(restored.id, existingWork.id);

  const restoredMeta = JSON.parse(readFileSync(join(orphanDir, META_FILE_NAME), "utf-8")) as {
    id: string;
    defaultPlaylist: string;
    defaultPlaylistId: string;
  };
  assert.equal(restoredMeta.id, restored.id);
  assert.equal(restoredMeta.defaultPlaylist, "default");
  assert.notEqual(restoredMeta.defaultPlaylistId, playlistId);
});
