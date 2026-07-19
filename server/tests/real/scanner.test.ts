// real アダプタのスキャナー結合テスト。
// サンプルライブラリ構成（tests/helpers/sampleLibrary.ts）:
//   dlsite/RJ900001_テスト作品/ … メタなし（mp3/ に 2秒+3秒 の WAV、cover.jpg）→ 自動生成対象
//   dlsite/RJ900002_既存メタ/   … .meta.json あり、トラック1本欠損 → status "error"
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { makeSampleLibrary, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  return { ...lib, adapter };
}

test("初回スキャン: 登録・自動生成・エラー検出・duration プローブ", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
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
  assert.match(meta.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.match(
    meta.playlists[0].id,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.equal(meta.defaultPlaylistId, meta.playlists[0].id);
  assert.equal(meta.playlists[0].tracks.length, 2);
  assert.ok(
    meta.playlists[0].tracks.every((track: { id: string }) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(track.id),
    ),
  );
  assert.equal(meta.playlists[0].tracks[0].file, "mp3/01_intro.wav");
  assert.deepEqual(meta.dlsite, {
    rjCode: "RJ900001",
    status: "none",
    lastAttemptAt: null,
    error: null,
    appliedTags: [],
  });

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
  assert.equal(existing.dlsite.rjCode, "RJ900002");
});

test("DLsite状態: メタ未定義はnone扱いで検出コードを書き戻し、再スキャンでDBへ復元する", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
  await adapter.scan();
  const metaPath = join(root, "dlsite", "RJ900002_既存メタ", ".meta.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.dlsite = {
    rjCode: "RJ7654321",
    status: "error",
    lastAttemptAt: "2026-07-12T00:00:00.000Z",
    error: "一時的な取得失敗",
    appliedTags: ["genre/耳かき"],
  };
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  await adapter.scan();
  const restored = await adapter.getWork(existingWorkId);
  assert.deepEqual(restored?.dlsite, meta.dlsite);
});

test("移動追従: フォルダー移動後も同一 ID で path 更新・DB固有情報を保持", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
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

test("行方不明: フォルダー削除後の再スキャンで missing になる", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
  await adapter.scan();

  rmSync(join(root, "dlsite", "RJ900002_既存メタ"), { recursive: true });
  const result = await adapter.scan();

  assert.equal(result.missing, 1);
  const work = await adapter.getWork(existingWorkId);
  assert.equal(work?.status, "missing");
});

test("UUID 重複: 後に検出された方が再採番されメタファイルへ書き戻される", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const root = join(lib.baseDir, "lib-dup");
  const id = "22222222-2222-4222-8222-222222222222";
  const playlistId = "33333333-3333-4333-8333-333333333333";
  const trackId = "44444444-4444-4444-8444-444444444444";
  for (const name of ["work-a", "work-b"]) {
    mkdirSync(join(root, name), { recursive: true });
    writeWav(join(root, name, "track.wav"), 1);
    writeFileSync(
      join(root, name, ".meta.json"),
      JSON.stringify({
        id,
        title: name,
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "t", file: "track.wav" }],
          },
        ],
        defaultPlaylistId: playlistId,
      }),
    );
  }
  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  const result = await adapter.scan();

  assert.equal(result.registered, 2);
  const metaA = JSON.parse(readFileSync(join(root, "work-a", ".meta.json"), "utf-8"));
  const metaB = JSON.parse(readFileSync(join(root, "work-b", ".meta.json"), "utf-8"));
  assert.equal(metaA.id, id); // 正規化パス順の先頭が所有する
  assert.equal(metaA.playlists[0].id, playlistId);
  assert.equal(metaA.playlists[0].tracks[0].id, trackId);
  assert.notEqual(metaB.id, id);
  assert.notEqual(metaB.playlists[0].id, playlistId);
  assert.notEqual(metaB.playlists[0].tracks[0].id, trackId);
  assert.equal(metaB.defaultPlaylistId, metaB.playlists[0].id);
  const works = await adapter.queryWorks({ q: "", tags: [], tagOp: "AND", sort: "added-desc" });
  assert.equal(works.total, 2);
});

test("メタ不正: 壊れた JSON は errors にカウントされスキャン自体は成功する", async (t) => {
  const { adapter, root } = await setup(t);
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

test("大量ディレクトリの走査中、walking フェーズの進捗イベントが複数回発火する（同期walkの詰まり修正の検証）", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const root = join(lib.baseDir, "lib-many-dirs");
  const dirCount = 120;
  for (let i = 0; i < dirCount; i++) {
    mkdirSync(join(root, `dir-${i}`), { recursive: true });
  }
  const adapter = createRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });

  const walkingEvents: { processed: number; total: number }[] = [];
  await adapter.scan((event) => {
    if (event.type === "progress" && event.phase === "walking") {
      walkingEvents.push({ processed: event.processed, total: event.total });
    }
  });

  // root自身 + 120個の子ディレクトリ = 121回の readdir。WALK_PROGRESS_INTERVAL(50)ごとに
  // emitされるため、初回(processed=0)に加えて途中経過が複数回届くはず
  // （同期walkのままなら完了までemitされず、この時点で1件しか届かない）
  assert.ok(
    walkingEvents.length >= 3,
    `walking イベントが複数回発火すること: ${walkingEvents.length}`,
  );
  assert.equal(walkingEvents[0]!.processed, 0);
  const processedValues = walkingEvents.map((e) => e.processed);
  for (let i = 1; i < processedValues.length; i++) {
    assert.ok(processedValues[i]! > processedValues[i - 1]!, "processed は単調増加");
  }
  assert.ok(
    walkingEvents.every((e) => e.total === 0),
    "total は不定(0)のまま",
  );
});

test("登録済み作品のメタが壊れた場合は missing ではなく error にする", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
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
