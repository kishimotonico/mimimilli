// real アダプタのスキャナー結合テスト。
// サンプルライブラリ構成（tests/helpers/sampleLibrary.ts）:
//   dlsite/RJ900001_テスト作品/ … メタなし（mp3/ に 2秒+3秒 の WAV、cover.jpg）→ 自動生成対象
//   dlsite/RJ900002_既存メタ/   … mimimilli.json あり、トラック1本欠損 → status "error"
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { EMPTY_TAG_FILTERS } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { openDb, type Db } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { audioProbeCache } from "../../src/adapters/real/catalogSchema.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: lib.root });
  return { ...lib, adapter };
}

function countWorkStates(db: Db): number {
  const row = db.sqlite.query("SELECT COUNT(*) AS total FROM user.work_states").get() as {
    total: number;
  };
  return row.total;
}

test("初回スキャン: 登録・自動生成・エラー検出・duration プローブ", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
  const result = await adapter.scan();

  assert.equal(result.registered, 1);
  assert.equal(result.newlyGenerated, 1);
  assert.equal(result.newWorkIds.length, 1);
  assert.equal(result.missing, 0);

  // 自動生成された mimimilli.json が物理的に存在し、作品ルートは mp3/ ではなく RJ900001 になる
  const generatedMeta = join(root, "dlsite", "RJ900001_テスト作品", "mimimilli.json");
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
    errorKind: null,
    appliedTags: [],
  });

  // duration プローブ（2秒 + 3秒）
  const generated = await adapter.getWork(result.newWorkIds[0]!);
  assert.ok(generated);
  assert.ok(generated.totalDurationSec !== null);
  assert.ok(
    Math.abs(generated.totalDurationSec - 5) < 0.05,
    `expected ~5, got ${generated.totalDurationSec}`,
  );
  // カバー寸法がSharpで計測されDBへ永続化・DTOへ投影されている（writeSampleCoverは6x4 JPEG）
  assert.deepEqual(generated!.cover, { image: "cover.jpg", dimensions: { width: 6, height: 4 } });
  assert.equal(result.coverErrors, 0);

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
  const metaPath = join(root, "dlsite", "RJ900002_既存メタ", "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.dlsite = {
    rjCode: "RJ7654321",
    status: "error",
    lastAttemptAt: "2026-07-12T00:00:00.000Z",
    error: "一時的な取得失敗",
    errorKind: null,
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
      join(root, name, "mimimilli.json"),
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
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  const result = await adapter.scan();

  assert.equal(result.registered, 2);
  const metaA = JSON.parse(readFileSync(join(root, "work-a", "mimimilli.json"), "utf-8"));
  const metaB = JSON.parse(readFileSync(join(root, "work-b", "mimimilli.json"), "utf-8"));
  assert.equal(metaA.id, id); // 正規化パス順の先頭が所有する
  assert.equal(metaA.playlists[0].id, playlistId);
  assert.equal(metaA.playlists[0].tracks[0].id, trackId);
  assert.notEqual(metaB.id, id);
  assert.notEqual(metaB.playlists[0].id, playlistId);
  assert.notEqual(metaB.playlists[0].tracks[0].id, trackId);
  assert.equal(metaB.defaultPlaylistId, metaB.playlists[0].id);
  const works = await adapter.queryWorks({
    q: "",
    tags: EMPTY_TAG_FILTERS,
    tagOp: "AND",
    sort: "added-desc",
  });
  assert.equal(works.total, 2);
});

test("メタ不正: 壊れた JSON は errors にカウントされスキャン自体は成功する", async (t) => {
  const { adapter, root } = await setup(t);
  const brokenDir = join(root, "broken-work");
  mkdirSync(brokenDir, { recursive: true });
  writeWav(join(brokenDir, "track.wav"), 1);
  writeFileSync(join(brokenDir, "mimimilli.json"), "{ これは JSON ではない");

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
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });

  const walkingEvents: { processed: number; total: number }[] = [];
  await adapter.scan({
    onProgress: (event) => {
      if (event.type === "progress" && event.phase === "walking") {
        walkingEvents.push({ processed: event.processed, total: event.total });
      }
    },
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
  const metaPath = join(root, "dlsite", "RJ900002_既存メタ", "mimimilli.json");
  writeFileSync(metaPath, "{ broken");

  const result = await adapter.scan();
  const work = await adapter.getWork(existingWorkId);

  assert.equal(result.errors, 1);
  assert.equal(result.missing, 0);
  assert.equal(work?.status, "error");
  assert.match(work?.errorMessage ?? "", /JSON パースエラー/);
});

// ── 増分スキャン（TASK-75） ─────────────────────────────────────────────────

test("増分スキャン: 完全未変更の作品は2回目以降スキップされる", async (t) => {
  const { adapter } = await setup(t);
  const first = await adapter.scan();
  assert.equal(first.skipped, 0);
  assert.equal(first.registered, 1);
  assert.equal(first.newlyGenerated, 1);

  const second = await adapter.scan();
  assert.equal(second.registered, 1); // error状態の既存メタは毎回再評価（TASK-95）
  assert.equal(second.newlyGenerated, 0);
  assert.equal(second.skipped, 1); // 正常な自動生成メタのみスキップ
  assert.equal(second.missing, 0);
  assert.equal(second.errors, 0);
});

test("増分スキャン: スキップした作品もPlaylist/Trackとresumeを維持する", async (t) => {
  const { adapter } = await setup(t);
  const first = await adapter.scan();
  const workId = first.newWorkIds[0]!;
  const before = await adapter.getWork(workId);
  assert.ok(before);
  const playlist = before!.playlists[0]!;
  const track = playlist.tracks[0]!;
  assert.ok(
    await adapter.saveResume(workId, { playlistId: playlist.id, trackId: track.id, offsetSec: 1 }),
  );

  const second = await adapter.scan();
  assert.equal(second.skipped, 1);
  assert.deepEqual((await adapter.getWork(workId))?.resume, {
    playlistId: playlist.id,
    trackId: track.id,
    offsetSec: 1,
  });
});

test("増分スキャン: 除外対象のcreatedAtが不正でも完全未変更ならschema検証を省略する", async (t) => {
  const { adapter, root } = await setup(t);
  await adapter.scan();
  const metaPath = join(root, "dlsite", "RJ900001_テスト作品", "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
  meta.createdAt = "これはISO日時ではない";
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const second = await adapter.scan();
  assert.equal(second.skipped, 1);
  assert.equal(second.errors, 0);
});

test("増分スキャン: playlists/tracks/urlsの未知キーはfingerprintから除外してスキップする", async (t) => {
  const directory = makeTestDirectory("raw-fingerprint-projection");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "work");
  const workId = "12345678-1234-4234-8234-123456789012";
  const playlistId = "22345678-1234-4234-8234-123456789012";
  const trackId = "32345678-1234-4234-8234-123456789012";
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    JSON.stringify({
      id: workId,
      title: "unknown fields",
      urls: [{ label: "source", url: "https://example.com", ignored: "url" }],
      playlists: [
        {
          id: playlistId,
          name: "default",
          ignored: "playlist",
          tracks: [
            {
              id: trackId,
              title: "track",
              file: "track.wav",
              ignored: "track",
            },
          ],
        },
      ],
      defaultPlaylistId: playlistId,
    }),
  );
  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path);
  await scanner.scan(root);

  // createdAtはfingerprint対象外かつ不正値なので、ここでZodを通るとerrorになる。
  const metaPath = join(workDir, "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
  meta.createdAt = "invalid timestamp";
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  let catalogUpsertCount = 0;
  let userUpsertCount = 0;
  const originalCatalogUpsert = repo.upsertWorkCatalog.bind(repo);
  const originalUserUpsert = repo.upsertWorkUserState.bind(repo);
  let probeCacheQueryCount = 0;
  const originalQuery = db.sqlite.query.bind(db.sqlite);
  repo.upsertWorkCatalog = (work, options) => {
    catalogUpsertCount += 1;
    originalCatalogUpsert(work, options);
  };
  repo.upsertWorkUserState = (work) => {
    userUpsertCount += 1;
    originalUserUpsert(work);
  };
  db.sqlite.query = ((sql: string, ...params: unknown[]) => {
    if (typeof sql === "string" && sql.includes("audio_probe_cache")) probeCacheQueryCount += 1;
    return (
      originalQuery as (sql: string, ...params: unknown[]) => ReturnType<typeof db.sqlite.query>
    )(sql, ...params);
  }) as unknown as Db["sqlite"]["query"];
  try {
    const second = await scanner.scan(root);
    assert.equal(second.skipped, 1);
    assert.equal(second.registered, 0);
    assert.equal(second.errors, 0);
  } finally {
    repo.upsertWorkCatalog = originalCatalogUpsert;
    repo.upsertWorkUserState = originalUserUpsert;
    db.sqlite.query = originalQuery;
  }
  assert.equal(catalogUpsertCount, 0);
  assert.equal(userUpsertCount, 0);
  assert.equal(probeCacheQueryCount, 0);
});

test("増分スキャン: 音声削除時は fingerprint 不一致で再処理され error になる", async (t) => {
  const { adapter, root } = await setup(t);
  const first = await adapter.scan();
  const generatedId = first.newWorkIds[0]!;

  const before = await adapter.getWork(generatedId);
  assert.equal(before?.status, "ok");

  rmSync(join(root, "dlsite", "RJ900001_テスト作品", "mp3", "01_intro.wav"));

  const second = await adapter.scan();
  assert.equal(second.skipped, 0);
  assert.equal(second.missing, 0);

  const after = await adapter.getWork(generatedId);
  assert.equal(after?.status, "error");
  assert.match(after?.errorMessage ?? "", /01_intro\.wav/);
});

test("増分スキャン: 音声 mtime/size 変更時は duration が再計算される", async (t) => {
  const { adapter, root } = await setup(t);
  const first = await adapter.scan();
  const generatedId = first.newWorkIds[0]!;

  const before = await adapter.getWork(generatedId);
  assert.ok(before);
  assert.ok(before!.totalDurationSec !== null);
  const beforeDuration = before!.totalDurationSec!;

  // 01_intro.wav を 2秒 → 4秒 に差し替え、合計 duration が 2秒増えるはず
  writeWav(join(root, "dlsite", "RJ900001_テスト作品", "mp3", "01_intro.wav"), 4);

  const second = await adapter.scan();
  assert.equal(second.skipped, 0);

  const after = await adapter.getWork(generatedId);
  assert.ok(after);
  assert.ok(after!.totalDurationSec !== null);
  assert.ok(
    Math.abs(after!.totalDurationSec! - (beforeDuration + 2)) < 0.05,
    `expected duration +2, before=${beforeDuration}, after=${after!.totalDurationSec}`,
  );
});

test("増分スキャン: 音声のmtimeだけが変わっても再処理する", async (t) => {
  const { adapter, root } = await setup(t);
  await adapter.scan();
  const audioPath = join(root, "dlsite", "RJ900001_テスト作品", "mp3", "01_intro.wav");
  utimesSync(audioPath, new Date(), new Date(Date.now() + 2_000));

  const second = await adapter.scan();
  assert.equal(second.skipped, 0);
  assert.equal(second.registered, 2);
});

test("増分スキャン: カバー画像の更新でも再処理する", async (t) => {
  const { adapter, root } = await setup(t);
  await adapter.scan();
  const coverPath = join(root, "dlsite", "RJ900001_テスト作品", "cover.jpg");
  writeFileSync(coverPath, "updated cover image");

  const second = await adapter.scan();
  assert.equal(second.skipped, 0);
  assert.equal(second.registered, 2);
});

test("カバー計測失敗: 画像が読めない場合は寸法NULLでcoverErrorsに計上され、DTOはcover:nullになる", async (t) => {
  const { adapter, root } = await setup(t);
  const coverPath = join(root, "dlsite", "RJ900001_テスト作品", "cover.jpg");
  writeFileSync(coverPath, "not an image");

  const first = await adapter.scan();
  assert.equal(first.coverErrors, 1);
  const generated = await adapter.getWork(first.newWorkIds[0]!);
  // 画像はあるが計測失敗＝表示可能なカバー無しとしてnull投影する（0/1で埋めない）
  assert.equal(generated!.cover, null);
  assert.equal(generated!.coverKind, "unmeasured");
  assert.equal(generated!.coverImage, "cover.jpg");

  // 寸法が欠損したままなのでearly skipは許可されず、次回スキャンでも再試行される
  const second = await adapter.scan();
  assert.equal(second.skipped, 0);
  assert.equal(second.coverErrors, 1);
});

test("増分スキャン: ディレクトリ移動を同一 UUID で追跡し fingerprint を再計算する", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
  await adapter.scan();
  await adapter.patchWork(existingWorkId, { bookmarked: true });

  const oldDir = join(root, "dlsite", "RJ900002_既存メタ");
  const newDir = join(root, "RJ900002_移動先");
  renameSync(oldDir, newDir);

  const second = await adapter.scan();
  assert.equal(second.skipped, 1); // 自動生成作品は未変更のままスキップ
  assert.equal(second.missing, 0);

  const work = await adapter.getWork(existingWorkId);
  assert.ok(work);
  assert.ok(work!.physicalPath.endsWith("RJ900002_移動先"));
  assert.equal(work!.bookmarked, true);
});

test("増分スキャン: registering 進捗の processed/total はスキップ含む全作品数が正しい", async (t) => {
  const { adapter } = await setup(t);
  await adapter.scan();

  const events: Array<{ processed: number; total: number }> = [];
  await adapter.scan({
    onProgress: (event) => {
      if (event.type === "progress" && event.phase === "registering") {
        events.push({ processed: event.processed, total: event.total });
      }
    },
  });

  assert.equal(events[events.length - 1]!.processed, 2);
  assert.equal(events[events.length - 1]!.total, 2);
  assert.ok(events.every((e) => e.total === 2));
  const processedValues = events.map((e) => e.processed);
  for (let i = 1; i < processedValues.length; i++) {
    assert.ok(processedValues[i]! >= processedValues[i - 1]!, "processed は単調非減少");
  }
});

test("増分スキャン: error状態の作品はfingerprint一致でも再評価される", async (t) => {
  const { adapter, existingWorkId, root } = await setup(t);
  await adapter.scan();
  const before = await adapter.getWork(existingWorkId);
  assert.equal(before?.status, "error");

  writeWav(join(root, "dlsite", "RJ900002_既存メタ", "missing.wav"), 1);

  const second = await adapter.scan();
  assert.equal(second.skipped, 1);

  const after = await adapter.getWork(existingWorkId);
  assert.equal(after?.status, "ok");
  assert.equal(after?.errorMessage, null);
});

test("強制フルスキャン: fingerprint一致作品も含め全件再処理する", async (t) => {
  const { adapter } = await setup(t);
  await adapter.scan();

  const second = await adapter.scan({ full: true });
  assert.equal(second.skipped, 0);
  assert.equal(second.registered, 2);
});

test("error作品の再評価時はprobe cacheをバイパスし誤durationから回復する", async (t) => {
  const directory = makeTestDirectory("probe-cache-bypass-error");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "work");
  const workId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const playlistId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const trackId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  mkdirSync(workDir, { recursive: true });
  const audioPath = join(workDir, "track.wav");
  writeWav(audioPath, 10);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    JSON.stringify({
      id: workId,
      title: "probe-cache-bypass",
      playlists: [
        {
          id: playlistId,
          name: "default",
          tracks: [{ id: trackId, title: "track", file: "track.wav", start: 5 }],
        },
      ],
      defaultPlaylistId: playlistId,
    }),
  );

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path);

  const stat = statSync(audioPath);
  db.catalog
    .insert(audioProbeCache)
    .values({
      path: audioPath,
      size: stat.size,
      mtimeMs: Math.floor(stat.mtimeMs),
      durationSec: 1,
    })
    .run();

  const first = await scanner.scan(root);
  assert.equal(first.registered, 1);
  const work = await repo.getWork(workId);
  assert.ok(work);
  assert.equal(work!.status, "error");
  assert.match(work!.errorMessage ?? "", /開始位置がファイル長を超えています/);

  const second = await scanner.scan(root);
  assert.equal(second.registered, 1);
  const recovered = await repo.getWork(workId);
  assert.equal(recovered!.status, "ok");
  assert.equal(recovered!.errorMessage, null);
});

test("増分スキャン: 2回目に検出したduplicate UUIDもID移行後に別作品として登録する", async (t) => {
  const { adapter, root } = await setup(t);
  await adapter.scan();
  const sourceDir = join(root, "dlsite", "RJ900001_テスト作品");
  const duplicateDir = join(root, "duplicate-work");
  mkdirSync(duplicateDir, { recursive: true });
  writeWav(join(duplicateDir, "track.wav"), 1);
  const source = JSON.parse(readFileSync(join(sourceDir, "mimimilli.json"), "utf-8")) as Record<
    string,
    unknown
  >;
  source.title = "duplicate-work";
  source.playlists = [
    {
      id: (source.playlists as Array<Record<string, unknown>>)[0]!.id,
      name: "default",
      tracks: [
        {
          id: (
            (source.playlists as Array<Record<string, unknown>>)[0]!.tracks as Array<
              Record<string, unknown>
            >
          )[0]!.id,
          title: "track",
          file: "track.wav",
        },
      ],
    },
  ];
  source.defaultPlaylistId = (source.playlists as Array<Record<string, unknown>>)[0]!.id;
  writeFileSync(join(duplicateDir, "mimimilli.json"), JSON.stringify(source, null, 2));

  const second = await adapter.scan();
  assert.equal(second.registered, 2);
  assert.equal(second.skipped, 1);
  const copiedMeta = JSON.parse(readFileSync(join(duplicateDir, "mimimilli.json"), "utf-8"));
  assert.notEqual(copiedMeta.id, source.id);
  assert.equal(
    (await adapter.queryWorks({ q: "", tags: EMPTY_TAG_FILTERS, tagOp: "AND", sort: "id-asc" }))
      .total,
    3,
  );
});

function metaWithSingleTrack(id: string, title: string): unknown {
  return {
    id,
    title,
    playlists: [
      {
        id: crypto.randomUUID(),
        name: "default",
        tracks: [{ id: crypto.randomUUID(), title: "track", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: null,
  };
}

test("probe cache は一括取得され作品数に比例しない", async (t) => {
  const directory = makeTestDirectory("probe-cache");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workCount = 50;
  for (let i = 0; i < workCount; i++) {
    const workDir = join(root, `work-${i}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify(
        metaWithSingleTrack(`00000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `work-${i}`),
        null,
        2,
      ),
    );
  }

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path);

  let queryCount = 0;
  const originalQuery = db.sqlite.query.bind(db.sqlite);
  db.sqlite.query = ((sql: string, ...params: unknown[]) => {
    if (typeof sql === "string" && sql.includes("audio_probe_cache")) {
      queryCount += 1;
    }
    return (
      originalQuery as (sql: string, ...params: unknown[]) => ReturnType<typeof db.sqlite.query>
    )(sql, ...params);
  }) as unknown as Db["sqlite"]["query"];
  try {
    await scanner.scan(root);
  } finally {
    db.sqlite.query = originalQuery;
  }

  // 50作品のトラックを一括取得するため、audio_probe_cache への SELECT は 1 回だけ。
  // トラックごとの個別 SELECT が発生していれば 50 回近くになる。
  assert.equal(
    queryCount,
    1,
    `probe cache へのアクセス数が作品数に比例しています (N=${workCount}, queries=${queryCount})`,
  );
});

test("probe cache一括取得は空集合を問い合わせず、重複排除して900件境界で分割する", (t) => {
  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  let queryCount = 0;
  const originalQuery = db.sqlite.query.bind(db.sqlite);
  db.sqlite.query = ((sql: string, ...params: unknown[]) => {
    if (typeof sql === "string" && sql.includes("audio_probe_cache")) queryCount += 1;
    return (
      originalQuery as (sql: string, ...params: unknown[]) => ReturnType<typeof db.sqlite.query>
    )(sql, ...params);
  }) as unknown as Db["sqlite"]["query"];
  try {
    assert.deepEqual(repo.fetchProbeCache([]), new Map());
    const paths = Array.from({ length: 901 }, (_, index) => `/audio/${index}.wav`);
    repo.fetchProbeCache([...paths, paths[0]!, paths[900]!]);
  } finally {
    db.sqlite.query = originalQuery;
  }
  assert.equal(queryCount, 2);
});

test("変更済みの複数resume作品でもprobe cache SELECTは一括取得だけで済む", async (t) => {
  const directory = makeTestDirectory("scan-existing-state-map");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workIds = Array.from(
    { length: 3 },
    (_, index) => `22222222-2222-4222-8222-${String(index).padStart(12, "0")}`,
  );
  for (const [index, id] of workIds.entries()) {
    const workDir = join(root, `work-${index}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 2);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify(metaWithSingleTrack(id, `work-${index}`)),
    );
  }
  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path);
  await scanner.scan(root);
  for (const id of workIds) {
    const work = (await repo.getWork(id))!;
    const playlist = work.playlists[0]!;
    const track = playlist.tracks[0]!;
    assert.ok(repo.saveResume(id, { playlistId: playlist.id, trackId: track.id, offsetSec: 1 }));
    const metaPath = join(root, work.title, "mimimilli.json");
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
    meta.title = `${work.title} updated`;
    writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }

  let queryCount = 0;
  const originalQuery = db.sqlite.query.bind(db.sqlite);
  db.sqlite.query = ((sql: string, ...params: unknown[]) => {
    if (typeof sql === "string" && sql.includes("audio_probe_cache")) queryCount += 1;
    return (
      originalQuery as (sql: string, ...params: unknown[]) => ReturnType<typeof db.sqlite.query>
    )(sql, ...params);
  }) as unknown as Db["sqlite"]["query"];
  try {
    await scanner.scan(root);
  } finally {
    db.sqlite.query = originalQuery;
  }
  assert.equal(queryCount, 1);
});

test("upsertWork はバッチトランザクションで処理され件数上限で分割される", async (t) => {
  const directory = makeTestDirectory("batch-transaction");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workCount = 5;
  for (let i = 0; i < workCount; i++) {
    const workDir = join(root, `work-${i}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify(
        metaWithSingleTrack(`11111111-1111-4111-8111-${String(i).padStart(12, "0")}`, `work-${i}`),
        null,
        2,
      ),
    );
  }

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path, { upsertBatchSize: 2 });

  let catalogTransactionCount = 0;
  let userTransactionCount = 0;
  const originalCatalogTransaction = db.transaction;
  const originalUserTransaction = db.userTransaction;
  db.transaction = <T>(callback: () => T): T => {
    catalogTransactionCount += 1;
    return originalCatalogTransaction(callback);
  };
  db.userTransaction = <T>(callback: () => T): T => {
    userTransactionCount += 1;
    return originalUserTransaction(callback);
  };

  await scanner.scan(root);

  assert.ok(
    catalogTransactionCount >= 3,
    `catalogバッチトランザクションが分割されること: expected >=3, got ${catalogTransactionCount}`,
  );
  assert.equal(
    userTransactionCount,
    catalogTransactionCount,
    "userとcatalogのバッチトランザクション回数は一致する",
  );
  assert.equal(repo.countByStatus("ok"), workCount);
});

test("upsertBatchSizeは有限の正整数だけを受け付ける", (t) => {
  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  for (const upsertBatchSize of [0, -1, 1.5, Number.POSITIVE_INFINITY]) {
    assert.throws(() => new Scanner(db, repo, "/test", { upsertBatchSize }), /有限の正整数/);
  }
});

test("バッチ途中のcatalog書込失敗はcatalogのみロールバックされ、再スキャンできる", async (t) => {
  const directory = makeTestDirectory("batch-rollback");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  for (let index = 0; index < 2; index++) {
    const workDir = join(root, `work-${index}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify(
        metaWithSingleTrack(
          `33333333-3333-4333-8333-${String(index).padStart(12, "0")}`,
          `work-${index}`,
        ),
      ),
    );
  }
  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path, { upsertBatchSize: 2 });
  const originalCatalogUpsert = repo.upsertWorkCatalog.bind(repo);
  let calls = 0;
  repo.upsertWorkCatalog = (work, options) => {
    calls += 1;
    if (calls === 2) throw new Error("injected catalog write failure");
    originalCatalogUpsert(work, options);
  };
  try {
    await assert.rejects(scanner.scan(root), /injected catalog write failure/);
  } finally {
    repo.upsertWorkCatalog = originalCatalogUpsert;
  }
  assert.equal(repo.countByStatus("ok"), 0);
  assert.equal(countWorkStates(db), 2, "user先コミット済みのためwork_statesは孤児として残る");

  await scanner.scan(root);
  assert.equal(repo.countByStatus("ok"), 2);
  assert.equal(countWorkStates(db), 2);
});

test("user先コミット後のcatalog失敗はuser孤児を残すがopenDbは拒否せず再スキャンで収束する", async (t) => {
  const directory = makeTestDirectory("user-orphan-recovery");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.sqlite");
  const userPath = join(directory.path, "user.sqlite");
  const root = join(directory.path, "lib");
  for (let index = 0; index < 2; index++) {
    const workDir = join(root, `work-${index}`);
    mkdirSync(workDir, { recursive: true });
    writeWav(join(workDir, "track.wav"), 1);
    writeFileSync(
      join(workDir, "mimimilli.json"),
      JSON.stringify(
        metaWithSingleTrack(
          `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
          `work-${index}`,
        ),
      ),
    );
  }
  const db = openDb({ kind: "files", catalogPath, userPath });
  const repo = new WorkRepo(db);
  const scanner = new Scanner(db, repo, directory.path, { upsertBatchSize: 2 });
  const originalCatalogUpsert = repo.upsertWorkCatalog.bind(repo);
  let calls = 0;
  repo.upsertWorkCatalog = (work, options) => {
    calls += 1;
    if (calls === 2) throw new Error("injected catalog write failure");
    originalCatalogUpsert(work, options);
  };
  await assert.rejects(scanner.scan(root), /injected catalog write failure/);
  db.close();

  const reopened = openDb({ kind: "files", catalogPath, userPath });
  t.after(() => reopened.close());
  const reopenedRepo = new WorkRepo(reopened);
  assert.equal(reopenedRepo.countByStatus("ok"), 0);
  assert.equal(countWorkStates(reopened), 2, "catalogに無いwork_states孤児は許容される");

  const recoveredScanner = new Scanner(reopened, reopenedRepo, directory.path, {
    upsertBatchSize: 2,
  });
  await recoveredScanner.scan(root);
  assert.equal(reopenedRepo.countByStatus("ok"), 2);
  assert.equal(countWorkStates(reopened), 2);
});
