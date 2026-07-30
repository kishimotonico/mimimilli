// `.meta.json` 書き戻し（要件 v4 §3.1: DB 編集とメタファイル更新を同一操作内で行う）のテスト。
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { emptyDlsiteState } from "@mimimilli/shared";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  // スキーマ外のユーザー定義フィールドを仕込む
  const metaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", ".meta.json");
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.myNote = "ユーザーの手書きメモ";
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return { ...lib, adapter, metaPath };
}

test("patchWork の title / tags がメタファイルへ反映され、スキーマ外フィールドは保持される", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);

  const updated = await adapter.patchWork(existingWorkId, {
    title: "改題された作品",
    tags: ["cv/水瀬なずな", "新タグ"],
  });
  assert.equal(updated?.title, "改題された作品");

  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(meta.title, "改題された作品");
  assert.deepEqual(meta.tags, ["cv/水瀬なずな", "新タグ"]);
  assert.equal(meta.myNote, "ユーザーの手書きメモ"); // 知らないフィールドを消さない
  assert.equal(meta.id, existingWorkId);
});

test("bookmarked の PATCH はメタファイルを変更しない（DB 固有情報）", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const before = readFileSync(metaPath, "utf-8");

  const updated = await adapter.patchWork(existingWorkId, { bookmarked: true });
  assert.equal(updated?.bookmarked, true);
  assert.equal(readFileSync(metaPath, "utf-8"), before);
});

test("存在しない作品の patchWork は null", async (t) => {
  const { adapter } = await setup(t);
  assert.equal(await adapter.patchWork("no-such-id", { title: "x" }), null);
});

test("メタ書き戻し失敗時は DB の title / tags もロールバックされる", async (t) => {
  const { adapter, existingWorkId, metaPath } = await setup(t);
  const before = await adapter.getWork(existingWorkId);
  rmSync(metaPath);

  await assert.rejects(
    adapter.patchWork(existingWorkId, {
      title: "反映されないタイトル",
      tags: ["反映されないタグ"],
    }),
    /ENOENT/,
  );

  const after = await adapter.getWork(existingWorkId);
  assert.equal(after?.title, before?.title);
  assert.deepEqual(after?.tags, before?.tags);
});

test("単一ファイル形式作品の patch が同居する .meta.json を書き換えない", async (t) => {
  const dir = makeTestDirectory("coexisting-meta");
  t.after(dir.cleanup);
  const sharedDir = join(dir.path, "shared");
  mkdirSync(sharedDir, { recursive: true });

  const folderWorkId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const singleWorkId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const folderPlaylistId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const singlePlaylistId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const folderTrackId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const singleTrackId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  writeWav(join(sharedDir, "folder-track.wav"), 1);
  writeWav(join(sharedDir, "foo.wav"), 2);

  const folderMetaPath = join(sharedDir, ".meta.json");
  writeFileSync(
    folderMetaPath,
    JSON.stringify(
      {
        id: folderWorkId,
        title: "フォルダー形式作品",
        tags: ["フォルダータグ"],
        playlists: [
          {
            id: folderPlaylistId,
            name: "default",
            tracks: [{ id: folderTrackId, title: "folder", file: "folder-track.wav" }],
          },
        ],
        defaultPlaylistId: folderPlaylistId,
        urls: [],
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    ),
  );

  const singleMetaPath = join(sharedDir, "foo.meta.json");
  writeFileSync(
    singleMetaPath,
    JSON.stringify(
      {
        id: singleWorkId,
        title: "単一ファイル作品",
        tags: ["単一タグ"],
        playlists: [
          {
            id: singlePlaylistId,
            name: "default",
            tracks: [{ id: singleTrackId, title: "foo", file: "foo.wav" }],
          },
        ],
        defaultPlaylistId: singlePlaylistId,
        urls: [],
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    ),
  );

  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: dir.path });
  await adapter.scan();

  const folderMetaBefore = readFileSync(folderMetaPath, "utf-8");

  const updated = await adapter.patchWork(singleWorkId, {
    title: "単一ファイル改題",
    tags: ["単一タグ", "追記タグ"],
  });
  assert.equal(updated?.title, "単一ファイル改題");
  assert.equal(readFileSync(folderMetaPath, "utf-8"), folderMetaBefore);

  const singleAfter = JSON.parse(readFileSync(singleMetaPath, "utf-8"));
  assert.equal(singleAfter.title, "単一ファイル改題");
  assert.deepEqual(singleAfter.tags, ["単一タグ", "追記タグ"]);
});
