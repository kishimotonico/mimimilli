// 物理 FS ブラウズ（/api/fs）の結合テスト: ルート外遮断・作品対応付け・管理ファイル非表示。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import type { FsListing, Work, WorksPage } from "@mimimilli/shared";
import type { Hono } from "hono";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import type { FsWorkRef } from "../../src/adapters/real/fsBrowse.ts";
import { buildWorkPathIndex, findOwnerWork } from "../../src/adapters/real/fsBrowse.ts";
import { openDb, type Db } from "../../src/adapters/real/db.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { createApp, type AppEnv } from "../../src/app.ts";
import { makeSampleLibrary, writeWav } from "../helpers/sampleLibrary.ts";
import { upsertTestWork } from "../helpers/workTestUtils.ts";

function sampleWork(id: string, physicalPath: string): Work {
  return {
    id,
    title: id,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath,
    totalDurationSec: 1,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    bookmarked: false,
    lastPlayedAt: null,
    resume: null,
    dlsite: {
      rjCode: null,
      status: "none",
      lastAttemptAt: null,
      error: null,
      errorKind: null,
      appliedTags: [],
    },
  };
}

async function setup(t: TestContext, prepare?: (root: string) => void) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  prepare?.(lib.root);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return { app, root: resolve(lib.root), existingWorkId: lib.existingWorkId };
}

function workAt(id: string, physicalPath: string): FsWorkRef {
  return { id, physicalPath };
}

class LookupCountingMap<K, V> extends Map<K, V> {
  getCalls = 0;

  override get(key: K): V | undefined {
    this.getCalls += 1;
    return super.get(key);
  }
}

async function listing(app: Hono<AppEnv>, path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await app.request(`/api/fs${q}`);
  assert.equal(res.status, 200);
  return (await res.json()) as FsListing;
}

test("ルート外のパス指定は 404", async (t) => {
  const { app } = await setup(t);
  for (const path of ["/etc", "/", join("data", "..")]) {
    const res = await app.request(`/api/fs?path=${encodeURIComponent(path)}`);
    assert.equal(res.status, 404, `should block: ${path}`);
  }
});

test("作品ディレクトリには workId、作品配下のファイルには workId + workRelPath が付く", async (t) => {
  const { app, root, existingWorkId } = await setup(t);

  const dlsite = await listing(app, join(root, "dlsite"));
  const workDir = dlsite.entries.find((e) => e.name === "RJ900002_既存メタ");
  assert.equal(workDir?.isDir, true);
  assert.equal(workDir?.workId, existingWorkId);

  // 作品配下のサブフォルダー内ファイル（mp3/01_intro.wav）
  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const generated = works.items.find((w) => w.title.includes("RJ900001"))!;
  const mp3 = await listing(app, join(root, "dlsite", "RJ900001_テスト作品", "mp3"));
  const file = mp3.entries.find((e) => e.name === "01_intro.wav");
  assert.equal(file?.workId, generated.id);
  assert.equal(file?.workRelPath, "mp3/01_intro.wav");
  assert.equal(file?.fileType, "wav");
  assert.ok((file?.size ?? 0) > 0);
});

test("listing 自身の workId と parent、mimimilli.json の非表示", async (t) => {
  const { app, root, existingWorkId } = await setup(t);

  const workListing = await listing(app, join(root, "dlsite", "RJ900002_既存メタ"));
  assert.equal(workListing.workId, existingWorkId);
  assert.equal(workListing.parent, join(root, "dlsite"));
  assert.ok(
    !workListing.entries.some(
      (e) => e.name === "mimimilli.json" || e.name.endsWith(".mimimilli.json"),
    ),
  );

  const rootListing = await listing(app);
  assert.equal(rootListing.parent, null);
});

test("ネストした作品ルートではファイルを最も深い作品へ対応付ける", async (t) => {
  const nestedId = "22222222-2222-4222-8222-222222222222";
  const { app, root, existingWorkId } = await setup(t, (libraryRoot) => {
    const nested = join(libraryRoot, "dlsite", "RJ900002_既存メタ", "nested-work");
    mkdirSync(nested, { recursive: true });
    writeWav(join(nested, "nested.wav"), 1);
    writeFileSync(
      join(nested, "mimimilli.json"),
      JSON.stringify({
        id: nestedId,
        title: "ネストした作品",
        tags: [],
        playlists: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "default",
            tracks: [
              {
                id: "44444444-4444-4444-8444-444444444444",
                title: "nested",
                file: "nested.wav",
              },
            ],
          },
        ],
        defaultPlaylistId: "33333333-3333-4333-8333-333333333333",
      }),
    );
  });

  const parent = await listing(app, join(root, "dlsite", "RJ900002_既存メタ"));
  assert.equal(parent.workId, existingWorkId);
  assert.equal(parent.entries.find((entry) => entry.name === "nested-work")?.workId, nestedId);

  const nested = await listing(app, join(root, "dlsite", "RJ900002_既存メタ", "nested-work"));
  const file = nested.entries.find((entry) => entry.name === "nested.wav");
  assert.equal(file?.workId, nestedId);
  assert.equal(file?.workRelPath, "nested.wav");
});

test("物理パス索引は境界・重複・未登録を保ち、所有者探索は全作品走査しない", () => {
  const first = workAt("first", "/library/work");
  const duplicate = workAt("duplicate", "/library/work");
  const indexed = buildWorkPathIndex([first, duplicate]);
  assert.equal(indexed.get("/library/work")?.id, "first");
  assert.equal(findOwnerWork("/library", "/library/work-other/file.wav", indexed), null);
  assert.equal(findOwnerWork("/library", "/library/unregistered/file.wav", indexed), null);

  const works = [
    workAt("owner", "/library/registered"),
    ...Array.from({ length: 10_000 }, (_, i) => workAt(`other-${i}`, `/library/other-${i}`)),
  ];
  const countingIndex = new LookupCountingMap(buildWorkPathIndex(works));
  const owner = findOwnerWork("/library", "/library/registered/deep/file.wav", countingIndex);
  assert.equal(owner?.id, "owner");
  assert.equal(countingIndex.getCalls, 3);
});

test("listFsWorkRefs は対象ディレクトリと祖先・子孫の作品だけを返す", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);

  const base = "/library/dlsite";
  upsertTestWork(repo, sampleWork("w-root", `${base}/RJ900001`));
  upsertTestWork(repo, sampleWork("w-nested", `${base}/RJ900001/nested`));
  upsertTestWork(repo, sampleWork("w-other", `${base}/RJ900002`));

  const atNested = repo.listFsWorkRefs(`${base}/RJ900001/nested`);
  assert.deepEqual(atNested.map((w) => w.id).sort(), ["w-nested", "w-root"], "子孫と祖先のみ");

  const atSibling = repo.listFsWorkRefs(`${base}/RJ900002`);
  assert.deepEqual(
    atSibling.map((w) => w.id),
    ["w-other"],
  );

  const unrelated = repo.listFsWorkRefs("/elsewhere");
  assert.equal(unrelated.length, 0);

  db.close();
});

test("listFsWorkRefs は末尾区切りでも子孫を取りこぼさない", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);

  upsertTestWork(repo, sampleWork("w-under-lib", "/library/work"));
  assert.deepEqual(
    repo.listFsWorkRefs("/library/").map((w) => w.id),
    ["w-under-lib"],
  );

  const base = "/library/dlsite";
  upsertTestWork(repo, sampleWork("w-root", `${base}/RJ900001`));
  upsertTestWork(repo, sampleWork("w-nested", `${base}/RJ900001/nested`));
  assert.deepEqual(
    repo
      .listFsWorkRefs(`${base}/RJ900001/`)
      .map((w) => w.id)
      .sort(),
    ["w-nested", "w-root"],
  );

  db.close();
});

test("listFsWorkRefs の physical_path 重複時の先勝ちは listSummaries と同じ", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const physicalPath = "/library/duplicate";

  upsertTestWork(repo, sampleWork("w-first", physicalPath));
  upsertTestWork(repo, sampleWork("w-second", physicalPath));

  const expectedId = repo
    .listSummaries()
    .summaries.find((s) => s.physicalPath === physicalPath)?.id;
  assert.ok(expectedId, "listSummaries に重複 physical_path の作品があること");

  const indexed = buildWorkPathIndex(repo.listFsWorkRefs(physicalPath));
  assert.equal(indexed.get(physicalPath)?.id, expectedId);

  db.close();
});

test("listFsWorkRefs は listSummaries より軽量（タグ取得なし・SQL 1本）", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  for (let i = 0; i < 5; i++) {
    upsertTestWork(repo, sampleWork(`w-${i}`, `/library/w-${i}`));
  }

  let queryCount = 0;
  const original = db.sqlite.query.bind(db.sqlite);
  db.sqlite.query = ((sql: string) => {
    queryCount += 1;
    return original(sql);
  }) as Db["sqlite"]["query"];

  const refs = repo.listFsWorkRefs("/library/w-0");
  assert.equal(refs.length, 1);
  assert.equal(queryCount, 1);

  db.close();
});
