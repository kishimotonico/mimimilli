// listSummaries の行単位隔離が export / スマートフォルダー / スキャン finalize で継続することを検証する。
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type { Work } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { tags } from "../../src/adapters/real/catalogSchema.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { querySmartFolderWorks } from "../../src/adapters/real/smartFolderWorks.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { upsertTestWork, resolvedDuration } from "../helpers/workTestUtils.ts";
import { nts } from "../helpers/tag.ts";

function sampleWork(id: string, tag: string): Work {
  const playlistId = `${id}-playlist`;
  const trackId = `${id}-track`;
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: nts([tag]),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: trackId,
            title: "track",
            file: "track.wav",
            ...resolvedDuration(60),
          },
        ],
      },
    ],
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

function seedCorruptedPair(
  repo: WorkRepo,
  db: ReturnType<typeof openDb>,
): { goodId: string; badId: string } {
  const goodId = "work-good";
  const badId = "work-bad";
  upsertTestWork(repo, sampleWork(goodId, "cv/正常"));
  upsertTestWork(repo, { ...sampleWork(badId, "cv/正常"), tags: nts(["cv/正常", "cv/壊れ対象"]) });
  db.catalog.update(tags).set({ name: " CV/壊れ " }).where(eq(tags.name, "cv/壊れ対象")).run();
  return { goodId, badId };
}

function openFileDb(dir: string) {
  return openDb({
    kind: "files",
    catalogPath: join(dir, "catalog.sqlite"),
    userPath: join(dir, "user.sqlite"),
  });
}

test("export は壊れた作品を除外し dataIntegrityWarning を返す", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mimi-export-integrity-"));
  const db = openFileDb(dir);
  const repo = new WorkRepo(db);
  const { goodId, badId } = seedCorruptedPair(repo, db);
  const adapter = createRealAdapter({
    database: {
      kind: "files",
      catalogPath: join(dir, "catalog.sqlite"),
      userPath: join(dir, "user.sqlite"),
    },
    dataRoot: dir,
    dlsiteCache: { path: join(dir, "dlsite-cache.sqlite") },
  });
  try {
    const exported = await adapter.exportLibrary();
    const payload = JSON.parse(exported.data) as { works: Array<{ id: string }> };
    assert.deepEqual(
      payload.works.map((work) => work.id),
      [goodId],
    );
    assert.equal(exported.dataIntegrityWarning?.skippedCount, 1);
    assert.deepEqual(exported.dataIntegrityWarning?.skippedWorkIds, [badId]);
  } finally {
    adapter.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("ルールベース smart folder は壊れた候補を除外して WorksPage を返す", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const { goodId, badId } = seedCorruptedPair(repo, db);
  const page = querySmartFolderWorks(
    repo,
    {
      rules: [
        {
          conjunction: "WHERE",
          field: "タグ",
          operator: "∋",
          values: nts(["cv/正常"]),
        },
      ],
      sort: "id-asc",
    },
    { page: 1, limit: 200 },
  );
  assert.deepEqual(
    page.items.map((item) => item.id),
    [goodId],
  );
  assert.equal(page.dataIntegrityWarning?.skippedCount, 1);
  assert.deepEqual(page.dataIntegrityWarning?.skippedWorkIds, [badId]);
  db.close();
});

test("スキャン finalize は壊れた作品があっても ScanResult を返す", async () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const { badId } = seedCorruptedPair(repo, db);
  const root = mkdtempSync(join(tmpdir(), "mimi-scan-integrity-"));
  try {
    const scanner = new Scanner(db, repo, root);
    const result = await scanner.scan(root, { full: true });
    assert.equal(result.dataIntegrityWarning?.skippedCount, 1);
    assert.deepEqual(result.dataIntegrityWarning?.skippedWorkIds, [badId]);
    assert.equal(typeof result.rjCodeMissingCount, "number");
  } finally {
    rmSync(root, { recursive: true, force: true });
    db.close();
  }
});

test("HTTP smart folder は dataIntegrityWarning を返す", async () => {
  const dir = mkdtempSync(join(tmpdir(), "mimi-sf-integrity-"));
  const db = openFileDb(dir);
  const repo = new WorkRepo(db);
  const { goodId, badId } = seedCorruptedPair(repo, db);
  const folder = repo.createSmartFolder({
    name: "タグ一致",
    rules: [
      {
        conjunction: "WHERE",
        field: "タグ",
        operator: "∋",
        values: nts(["cv/正常"]),
      },
    ],
    sort: "id-asc",
  });
  const adapter = createRealAdapter({
    database: {
      kind: "files",
      catalogPath: join(dir, "catalog.sqlite"),
      userPath: join(dir, "user.sqlite"),
    },
    dataRoot: dir,
    dlsiteCache: { path: join(dir, "dlsite-cache.sqlite") },
  });
  try {
    const app = createApp(adapter);
    const res = await app.request(`/api/smart-folders/${folder.id}/works`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      items: Array<{ id: string }>;
      dataIntegrityWarning?: { skippedCount: number; skippedWorkIds: string[] };
    };
    assert.deepEqual(
      body.items.map((item) => item.id),
      [goodId],
    );
    assert.equal(body.dataIntegrityWarning?.skippedCount, 1);
    assert.deepEqual(body.dataIntegrityWarning?.skippedWorkIds, [badId]);
  } finally {
    adapter.close();
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
