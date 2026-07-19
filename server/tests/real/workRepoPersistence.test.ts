import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { searchPresets, smartFolders, works } from "../../src/adapters/real/schema.ts";
import { PersistentDataError, WorkRepo } from "../../src/adapters/real/workRepo.ts";

function sampleWork(id: string): Work {
  return {
    id,
    title: "永続データ検証用",
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 10,
    addedAt: "2026-07-19T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    defaultPlaylist: "default",
    createdAt: null,
    playlists: [
      {
        name: "default",
        tracks: [{ title: "track", file: "track.wav" }],
      },
    ],
    bookmarked: false,
    lastPlayedAt: null,
    resumePosition: 0,
    resumeTrackIndex: 0,
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

test("works.status が不正なら作品IDとフィールド名を含むエラーになる", () => {
  const db = openDb(":memory:");
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-status");
  repo.upsertWork(work);
  db.update(works).set({ status: "unknown" }).where(eq(works.id, work.id)).run();

  assertPersistentDataError(
    () => repo.listSummaries(),
    /works レコード "work-bad-status".*status:/,
  );
});

test("works.playlists_json が不正なら作品IDとフィールド名を含むエラーになる", () => {
  const db = openDb(":memory:");
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-playlists");
  repo.upsertWork(work);
  db.update(works)
    .set({ playlistsJson: '[{"name":"default","tracks":"broken"}]' })
    .where(eq(works.id, work.id))
    .run();

  assertPersistentDataError(
    () => repo.getWork(work.id),
    /works レコード "work-bad-playlists".*playlists\.0\.tracks:/,
  );
});

test("壊れたJSON構文は作品IDとSQLite列名を含むエラーになる", () => {
  const db = openDb(":memory:");
  const repo = new WorkRepo(db);
  const work = sampleWork("work-bad-json");
  repo.upsertWork(work);
  db.update(works).set({ playlistsJson: "[{" }).where(eq(works.id, work.id)).run();

  assertPersistentDataError(
    () => repo.getWork(work.id),
    /works レコード "work-bad-json".*playlists_json: JSON パースエラー:/,
  );
});

test("smart folderとsearch presetのsortも復元時に検証する", () => {
  const db = openDb(":memory:");
  const repo = new WorkRepo(db);
  db.insert(smartFolders)
    .values({
      id: "sf-bad-sort",
      name: "不正sort",
      rulesJson: "[]",
      sort: "unknown",
      createdAt: "2026-07-19T00:00:00.000Z",
    })
    .run();
  db.insert(searchPresets)
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
