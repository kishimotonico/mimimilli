import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { InvalidResumeError } from "../../src/adapter.ts";
import { migrateResumeV1, openDb } from "../../src/adapters/real/db.ts";
import { probeDurationSec } from "../../src/adapters/real/probe.ts";
import { resumeV1Pending, workStates } from "../../src/adapters/real/userSchema.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function sampleWork(id: string): Work {
  const playlistId = crypto.randomUUID();
  return {
    id,
    title: id,
    coverImage: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 90,
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
          { id: crypto.randomUUID(), title: "first", file: "shared.wav", start: 0, end: 30 },
          { id: crypto.randomUUID(), title: "second", file: "shared.wav", start: 30, end: 90 },
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

test("v2 resumeは区間相対秒で保存され、並べ替え後もTrack IDで復元する", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const work = sampleWork("resume-reorder");
  repo.upsertWork(work);
  const playlist = work.playlists[0]!;
  const track = playlist.tracks[1]!;

  assert.equal(
    repo.saveResume(work.id, { playlistId: playlist.id, trackId: track.id, offsetSec: 15 }),
    true,
  );
  assert.deepEqual(repo.getWork(work.id)?.resume, {
    playlistId: playlist.id,
    trackId: track.id,
    offsetSec: 15,
  });

  repo.upsertWork({
    ...work,
    playlists: [{ ...playlist, tracks: [playlist.tracks[1]!, playlist.tracks[0]!] }],
  });
  assert.deepEqual(repo.getWork(work.id)?.resume, {
    playlistId: playlist.id,
    trackId: track.id,
    offsetSec: 15,
  });
  db.close();
});

test("保存時に所属と区間を検証し、読出し時に解決不能な行だけを無効化する", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const work = sampleWork("resume-invalid");
  repo.upsertWork(work);
  const playlist = work.playlists[0]!;
  const track = playlist.tracks[1]!;

  assert.throws(
    () =>
      repo.saveResume(work.id, {
        playlistId: crypto.randomUUID(),
        trackId: track.id,
        offsetSec: 1,
      }),
    InvalidResumeError,
  );
  assert.throws(
    () => repo.saveResume(work.id, { playlistId: playlist.id, trackId: track.id, offsetSec: 61 }),
    InvalidResumeError,
  );

  const unresolvedTrackId = crypto.randomUUID();
  db.user
    .update(workStates)
    .set({
      resumePlaylistId: playlist.id,
      resumeTrackId: unresolvedTrackId,
      resumeOffsetSec: 10,
    })
    .where(eq(workStates.workId, work.id))
    .run();
  assert.equal(repo.getWork(work.id)?.resume, null);
  assert.equal(
    db.user.select().from(workStates).where(eq(workStates.workId, work.id)).get()?.resumeTrackId,
    unresolvedTrackId,
  );
  db.close();
});

test("resume v1をdefault Playlistとtrack.startから変換し、未解決行はpendingに残す", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const convertible = sampleWork("resume-v1-ok");
  const discarded = sampleWork("resume-v1-discard");
  repo.upsertWork(convertible);
  repo.upsertWork(discarded);
  db.user
    .insert(resumeV1Pending)
    .values([
      { workId: convertible.id, position: 45, trackIndex: 1 },
      { workId: discarded.id, position: 45, trackIndex: 9 },
    ])
    .run();

  assert.deepEqual(migrateResumeV1(db.sqlite), { converted: 1, pending: 1 });

  const playlist = convertible.playlists[0]!;
  assert.deepEqual(repo.getWork(convertible.id)?.resume, {
    playlistId: playlist.id,
    trackId: playlist.tracks[1]!.id,
    offsetSec: 15,
  });
  assert.equal(repo.getWork(discarded.id)?.resume, null);
  assert.deepEqual(db.user.select().from(resumeV1Pending).all(), [
    { workId: discarded.id, position: 45, trackIndex: 9 },
  ]);
  db.close();
});

test("user DB v2を再作成せずv3へ移行し、resume v1をpendingに退避する", (t) => {
  const directory = makeTestDirectory("resume-v1-user-db");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.sqlite");
  const userPath = join(directory.path, "user.sqlite");
  const location = { kind: "files" as const, catalogPath, userPath };
  const work = sampleWork("resume-v1-existing-user");

  const current = openDb(location);
  const repo = new WorkRepo(current);
  repo.upsertWork(work);
  repo.patchWork(work.id, { bookmarked: true });
  current.close();

  const userV2 = new Database(userPath);
  userV2.exec(`
    ALTER TABLE work_states RENAME TO work_states_v3;
    CREATE TABLE work_states (
      work_id TEXT PRIMARY KEY NOT NULL,
      added_at TEXT NOT NULL,
      bookmarked INTEGER DEFAULT 0 NOT NULL,
      last_played_at TEXT,
      resume_position REAL DEFAULT 0 NOT NULL,
      resume_track_index INTEGER DEFAULT 0 NOT NULL
    );
    INSERT INTO work_states
      (work_id, added_at, bookmarked, last_played_at, resume_position, resume_track_index)
    SELECT work_id, added_at, bookmarked, last_played_at, 45, 1 FROM work_states_v3;
    DROP TABLE work_states_v3;
    DROP TABLE resume_v1_pending;
    DELETE FROM __drizzle_migrations
    WHERE created_at = (SELECT MAX(created_at) FROM __drizzle_migrations);
    PRAGMA user_version = 2;
  `);
  userV2.close();

  const migrated = openDb(location);
  const migratedRepo = new WorkRepo(migrated);
  const pending = migrated.user.select().from(resumeV1Pending).all();
  assert.deepEqual(pending, [{ workId: work.id, position: 45, trackIndex: 1 }]);
  assert.deepEqual(migrateResumeV1(migrated.sqlite), { converted: 1, pending: 0 });
  const migratedWork = migratedRepo.getWork(work.id);
  const playlist = work.playlists[0]!;
  assert.equal(migratedWork?.bookmarked, true);
  assert.deepEqual(migratedWork?.resume, {
    playlistId: playlist.id,
    trackId: playlist.tracks[1]!.id,
    offsetSec: 15,
  });
  assert.equal(
    (migrated.sqlite.query("PRAGMA user.user_version").get() as { user_version: number })
      .user_version,
    3,
  );
  migrated.close();
});

test("end省略Trackは音声ファイルを300秒から60秒へ差し替えた後にoffset超過resumeを無効化する", async (t) => {
  const directory = makeTestDirectory("resume-file-replacement");
  t.after(directory.cleanup);
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const base = sampleWork("resume-probed-duration");
  const playlist = base.playlists[0]!;
  const track = { ...playlist.tracks[0]!, start: 0, end: undefined };
  const work = {
    ...base,
    physicalPath: directory.path,
    playlists: [{ ...playlist, tracks: [track] }],
  };
  repo.upsertWork(work);
  const cachePath = join(work.physicalPath, track.file);
  writeWav(cachePath, 300);
  assert.equal(await probeDurationSec(db.catalog, cachePath), 300);

  assert.equal(
    repo.saveResume(work.id, { playlistId: playlist.id, trackId: track.id, offsetSec: 200 }),
    true,
  );
  assert.equal(repo.getWork(work.id)?.resume?.offsetSec, 200);

  writeWav(cachePath, 60);
  assert.equal(await probeDurationSec(db.catalog, cachePath), 60);
  assert.equal(repo.getWork(work.id)?.resume, null);
  assert.throws(
    () => repo.saveResume(work.id, { playlistId: playlist.id, trackId: track.id, offsetSec: 200 }),
    InvalidResumeError,
  );
  db.close();
});
