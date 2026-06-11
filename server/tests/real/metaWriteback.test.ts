// `.meta.json` 書き戻し（要件 v4 §3.1: DB 編集とメタファイル更新を同一操作内で行う）のテスト。
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

const BASE = "data/test-writeback";

async function setup() {
  const lib = makeSampleLibrary(BASE);
  // スキーマ外のユーザー定義フィールドを仕込む
  const metaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", ".meta.json");
  const raw = JSON.parse(readFileSync(metaPath, "utf-8"));
  raw.myNote = "ユーザーの手書きメモ";
  writeFileSync(metaPath, JSON.stringify(raw, null, 2));

  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return { ...lib, adapter, metaPath };
}

test("patchWork の title / tags がメタファイルへ反映され、スキーマ外フィールドは保持される", async () => {
  const { adapter, existingWorkId, metaPath } = await setup();

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

test("bookmarked の PATCH はメタファイルを変更しない（DB 固有情報）", async () => {
  const { adapter, existingWorkId, metaPath } = await setup();
  const before = readFileSync(metaPath, "utf-8");

  const updated = await adapter.patchWork(existingWorkId, { bookmarked: true });
  assert.equal(updated?.bookmarked, true);
  assert.equal(readFileSync(metaPath, "utf-8"), before);
});

test("存在しない作品の patchWork は null", async () => {
  const { adapter } = await setup();
  assert.equal(await adapter.patchWork("no-such-id", { title: "x" }), null);
});

test("メタ書き戻し失敗時は DB の title / tags もロールバックされる", async () => {
  const { adapter, existingWorkId, metaPath } = await setup();
  const before = await adapter.getWork(existingWorkId);
  rmSync(metaPath);

  await assert.rejects(
    adapter.patchWork(existingWorkId, { title: "反映されないタイトル", tags: ["反映されないタグ"] }),
    /ENOENT/
  );

  const after = await adapter.getWork(existingWorkId);
  assert.equal(after?.title, before?.title);
  assert.deepEqual(after?.tags, before?.tags);
});
