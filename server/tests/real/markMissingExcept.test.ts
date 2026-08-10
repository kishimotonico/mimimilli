// TASK-62: markMissingExcept の一時テーブル方式化の検証。
// SQLite パラメータ上限を超える seen ID でも動作し、一時テーブルを残さないことを確認する。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import {
  createWorkRepos,
  getTestWork,
  resolvedDuration,
  upsertTestWork,
} from "../helpers/workTestUtils.ts";

function sampleWork(id: string): Work {
  const playlistId = crypto.randomUUID();
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
    tags: [],
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          { id: crypto.randomUUID(), title: "track", file: "track.wav", ...resolvedDuration(60) },
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

test("foundIds 以外の作品だけが missing になる", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("keep-1"));
  upsertTestWork(catalog, user, sampleWork("keep-2"));
  upsertTestWork(catalog, user, sampleWork("lost-1"));

  catalog.markMissingExcept(["keep-1", "keep-2"]);

  assert.equal((await getTestWork(db, "keep-1"))?.status, "ok");
  assert.equal((await getTestWork(db, "keep-2"))?.status, "ok");
  assert.equal((await getTestWork(db, "lost-1"))?.status, "missing");
  assert.equal((await getTestWork(db, "lost-1"))?.errorMessage, null);
  db.close();
});

test("foundIds が空なら全件 missing になる", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("w-1"));
  upsertTestWork(catalog, user, sampleWork("w-2"));

  catalog.markMissingExcept([]);

  assert.equal((await getTestWork(db, "w-1"))?.status, "missing");
  assert.equal((await getTestWork(db, "w-2"))?.status, "missing");
  db.close();
});

test("SQLiteパラメータ上限を超える大量IDでも動作し、一時テーブルを残さない", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  upsertTestWork(catalog, user, sampleWork("keep-1"));
  upsertTestWork(catalog, user, sampleWork("lost-1"));

  // SQLite のパラメータ上限（32766）を超える seen ID 数
  const manyIds = ["keep-1", ...Array.from({ length: 40_000 }, (_, i) => `seen-${i}`)];
  catalog.markMissingExcept(manyIds);

  assert.equal((await getTestWork(db, "keep-1"))?.status, "ok");
  assert.equal((await getTestWork(db, "lost-1"))?.status, "missing");

  const tempTables = db.sqlite
    .query("SELECT name FROM temp.sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  assert.equal(
    tempTables.some((t) => t.name === "scan_seen_ids"),
    false,
    "一時テーブル scan_seen_ids が残存しています",
  );
  db.close();
});
