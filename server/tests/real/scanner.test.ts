// real アダプタのスキャナー結合テスト。
// サンプルライブラリ構成（tests/helpers/sampleLibrary.ts）:
//   dlsite/RJ900001_テスト作品/ … メタなし（mp3/ に 2秒+3秒 の WAV、cover.jpg）→ 自動生成対象
//   dlsite/RJ900002_既存メタ/   … .meta.json あり、トラック1本欠損 → status "error"
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary, writeWav } from "../helpers/sampleLibrary.ts";

const BASE = "data/test-scanner";

async function setup() {
  const lib = makeSampleLibrary(BASE);
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: lib.root });
  return { ...lib, adapter };
}

test("初回スキャン: 登録・自動生成・エラー検出・duration プローブ", async () => {
  const { adapter, existingWorkId, root } = await setup();
  const result = await adapter.scan();

  assert.equal(result.registered, 1);
  assert.equal(result.newlyGenerated, 1);
  assert.equal(result.newWorkIds.length, 1);
  assert.equal(result.missing, 0);

  // 自動生成された .meta.json が物理的に存在し、作品ルートは mp3/ ではなく RJ900001 になる
  const generatedMeta = join(root, "dlsite", "RJ900001_テスト作品", ".meta.json");
  assert.ok(existsSync(generatedMeta));
  const meta = JSON.parse(readFileSync(generatedMeta, "utf-8"));
  assert.equal(meta.coverImage, "cover.jpg");
  assert.equal(meta.playlists[0].tracks.length, 2);
  assert.equal(meta.playlists[0].tracks[0].file, "mp3/01_intro.wav");

  // duration プローブ（2秒 + 3秒）
  const generated = await adapter.getWork(result.newWorkIds[0]!);
  assert.ok(generated);
  assert.ok(
    Math.abs(generated.totalDurationSec - 5) < 0.05,
    `expected ~5, got ${generated.totalDurationSec}`,
  );

  // 欠損トラックの作品は error
  const existing = await adapter.getWork(existingWorkId);
  assert.ok(existing);
  assert.equal(existing.status, "error");
  assert.match(existing.errorMessage ?? "", /missing\.wav/);
});

test("移動追従: フォルダー移動後も同一 ID で path 更新・DB固有情報を保持", async () => {
  const { adapter, existingWorkId, root } = await setup();
  await adapter.scan();
  await adapter.patchWork(existingWorkId, { bookmarked: true });

  const oldDir = join(root, "dlsite", "RJ900002_既存メタ");
  const newDir = join(root, "RJ900002_移動先");
  renameSync(oldDir, newDir);

  const result = await adapter.scan();
  assert.equal(result.missing, 0);

  const work = await adapter.getWork(existingWorkId);
  assert.ok(work);
  assert.ok(work.physicalPath.endsWith("RJ900002_移動先"));
  assert.equal(work.bookmarked, true);
});

test("行方不明: フォルダー削除後の再スキャンで missing になる", async () => {
  const { adapter, existingWorkId, root } = await setup();
  await adapter.scan();

  rmSync(join(root, "dlsite", "RJ900002_既存メタ"), { recursive: true });
  const result = await adapter.scan();

  assert.equal(result.missing, 1);
  const work = await adapter.getWork(existingWorkId);
  assert.equal(work?.status, "missing");
});

test("UUID 重複: 後に検出された方が再採番されメタファイルへ書き戻される", async () => {
  const root = join(BASE, "lib-dup");
  rmSync(root, { recursive: true, force: true });
  const id = "22222222-2222-4222-8222-222222222222";
  for (const name of ["work-a", "work-b"]) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
    writeFileSync(
      join(root, name, ".meta.json"),
      JSON.stringify({
        id,
        title: name,
        playlists: [{ name: "default", tracks: [{ title: "t", file: "track.wav" }] }],
      }),
    );
  }
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  await adapter.updateSettings({ rootFolder: root });
  const result = await adapter.scan();

  assert.equal(result.registered, 2);
  const idA = JSON.parse(readFileSync(join(root, "work-a", ".meta.json"), "utf-8")).id;
  const idB = JSON.parse(readFileSync(join(root, "work-b", ".meta.json"), "utf-8")).id;
  assert.notEqual(idA, idB);
  assert.ok([idA, idB].includes(id)); // 片方は元の ID のまま
  const works = await adapter.queryWorks({ q: "", tags: [], tagOp: "AND", sort: "added-desc" });
  assert.equal(works.total, 2);
});

test("メタ不正: 壊れた JSON は errors にカウントされスキャン自体は成功する", async () => {
  const { adapter, root } = await setup();
  const brokenDir = join(root, "broken-work");
  mkdirSync(brokenDir, { recursive: true });
  writeWav(join(brokenDir, "track.wav"), 1);
  writeFileSync(join(brokenDir, ".meta.json"), "{ これは JSON ではない");

  const result = await adapter.scan();
  assert.equal(result.errors, 1);
  assert.equal(result.registered, 1); // 既存メタ作品は通常どおり登録される
  // メタ不正フォルダーは「メタあり」扱いなので自動生成はされない
  assert.equal(result.newlyGenerated, 1); // RJ900001 のみ
});

test("登録済み作品のメタが壊れた場合は missing ではなく error にする", async () => {
  const { adapter, existingWorkId, root } = await setup();
  await adapter.scan();
  const metaPath = join(root, "dlsite", "RJ900002_既存メタ", ".meta.json");
  writeFileSync(metaPath, "{ broken");

  const result = await adapter.scan();
  const work = await adapter.getWork(existingWorkId);

  assert.equal(result.errors, 1);
  assert.equal(result.missing, 0);
  assert.equal(work?.status, "error");
  assert.match(work?.errorMessage ?? "", /JSON パースエラー/);
});
