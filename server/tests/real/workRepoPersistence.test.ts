import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { works } from "../../src/adapters/real/catalogSchema.ts";
import { PersistentDataError, WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { searchPresets, smartFolders } from "../../src/adapters/real/userSchema.ts";

function sampleWork(id: string): Work {
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    id,
    title: "永続データ検証用",
    cover: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "track",
            file: "track.wav",
            durationSec: 60,
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
      appliedTags: [],
    },
  };
}

function assertPersistentDataError(action: () => unknown, expectedMessage: RegExp): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof PersistentDataError);
    assert.match(error.message, expectedMessage);
    return true;
  });
}

async function assertPersistentDataErrorAsync(
  action: () => Promise<unknown>,
  expectedMessage: RegExp,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof PersistentDataError);
    assert.match(error.message, expectedMessage);
    return true;
  });
}

test("works.status が不正なら作品IDとフィールド名を含むエラーになる", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-status");
  repo.upsertWork(work);
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, work.id)).run();

  assertPersistentDataError(
    () => repo.listSummaries(),
    /works レコード "work-bad-status".*status:/,
  );
});

test("works.playlists_json が不正なら作品IDとフィールド名を含むエラーになる", async () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-playlists");
  repo.upsertWork(work);
  db.catalog
    .update(works)
    .set({ playlistsJson: '[{"name":"default","tracks":"broken"}]' })
    .where(eq(works.id, work.id))
    .run();

  await assertPersistentDataErrorAsync(
    () => repo.getWork(work.id),
    /works レコード "work-bad-playlists".*0\.tracks:/,
  );
});

test("壊れたJSON構文は作品IDとSQLite列名を含むエラーになる", async () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-json");
  repo.upsertWork(work);
  db.catalog.update(works).set({ playlistsJson: "[{" }).where(eq(works.id, work.id)).run();

  await assertPersistentDataErrorAsync(
    () => repo.getWork(work.id),
    /works レコード "work-bad-json".*playlists_json: JSON パースエラー:/,
  );
});

test("smart folderとsearch presetのsortも復元時に検証する", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  db.user
    .insert(smartFolders)
    .values({
      id: "sf-bad-sort",
      name: "不正sort",
      rulesJson: "[]",
      sort: "unknown",
      createdAt: "2026-07-19T00:00:00.000Z",
    })
    .run();
  db.user
    .insert(searchPresets)
    .values({
      name: "不正sort",
      query: "",
      tagFiltersJson: "[]",
      sortId: "unknown",
    })
    .run();

  assertPersistentDataError(
    () => repo.listSmartFolders(),
    /smart_folders レコード "sf-bad-sort".*sort:/,
  );
  assertPersistentDataError(() => repo.listPresets(), /search_presets レコード "1".*sortId:/);
});
