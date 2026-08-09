import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { works, tags } from "../../src/adapters/real/catalogSchema.ts";
import { smartFolders } from "../../src/adapters/real/userSchema.ts";
import { PersistentDataError } from "../../src/adapters/real/workRowMapping.ts";
import {
  upsertTestWork,
  resolvedDuration,
  createWorkRepos,
  getTestWork,
} from "../helpers/workTestUtils.ts";
import { nts } from "../helpers/tag.ts";

function sampleWork(id: string): Work {
  const playlistId = `${id}-playlist`;
  const trackId = `${id}-track`;
  return {
    id,
    title: "永続データ検証用",
    cover: null,
    coverKind: "none",
    coverImage: null,
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

function assertPersistentDataErrorAsync(
  action: () => Promise<unknown>,
  expectedMessage: RegExp,
): Promise<void> {
  return assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof PersistentDataError);
    assert.match(error.message, expectedMessage);
    return true;
  });
}

test("works.status が不正なら listSummaries は当該作品を隔離して続行する", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  const good = sampleWork("work-good-status");
  const bad = sampleWork("work-bad-status");
  upsertTestWork(catalog, user, good);
  upsertTestWork(catalog, user, bad);
  db.catalog.update(works).set({ status: "unknown" }).where(eq(works.id, bad.id)).run();

  const result = query.listSummaries();
  assert.equal(result.summaries.length, 1);
  assert.equal(result.summaries[0]!.id, good.id);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0]!.workId, bad.id);
  assert.match(result.skipped[0]!.reason, /status:/);
});

test("works.playlists_json が不正なら getWork はエラーのまま", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const work = sampleWork("work-bad-playlists");
  upsertTestWork(catalog, user, work);
  db.catalog
    .update(works)
    .set({ playlistsJson: '[{"name":"default","tracks":"broken"}]' })
    .where(eq(works.id, work.id))
    .run();

  await assertPersistentDataErrorAsync(
    () => getTestWork(db, work.id),
    /works レコード "work-bad-playlists".*0\.tracks:/,
  );
});

test("壊れたJSON構文は getWork で作品IDとSQLite列名を含むエラーになる", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const work = sampleWork("work-bad-json");
  upsertTestWork(catalog, user, work);
  db.catalog.update(works).set({ playlistsJson: "[{" }).where(eq(works.id, work.id)).run();

  await assertPersistentDataErrorAsync(
    () => getTestWork(db, work.id),
    /works レコード "work-bad-json".*playlists_json: JSON パースエラー:/,
  );
});

test("tags.name が正規化されていなければ listSummaries は当該作品を隔離して続行する", () => {
  const db = openDb({ kind: "memory" });
  const { query, catalog, user } = createWorkRepos(db);
  const good = sampleWork("work-good-tags");
  const bad = { ...sampleWork("work-bad-tags"), tags: nts(["cv/正常"]) };
  upsertTestWork(catalog, user, good);
  upsertTestWork(catalog, user, bad);
  db.catalog.update(tags).set({ name: " CV/壊れ " }).where(eq(tags.name, "cv/正常")).run();

  const result = query.listSummaries();
  assert.equal(result.summaries.length, 1);
  assert.equal(result.summaries[0]!.id, good.id);
  assert.equal(result.skipped.length, 1);
  assert.equal(result.skipped[0]!.workId, bad.id);
  assert.match(result.skipped[0]!.reason, /タグが正規化されていません/);
});

test("smart folderのsortも復元時に検証する", () => {
  const db = openDb({ kind: "memory" });
  const { user } = createWorkRepos(db);
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

  assert.throws(
    () => user.listSmartFolders(),
    (error: unknown) => {
      assert.ok(error instanceof PersistentDataError);
      assert.match(error.message, /smart_folders レコード "sf-bad-sort".*sort:/);
      return true;
    },
  );
});
