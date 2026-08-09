import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { eq } from "drizzle-orm";
import { InvalidResumeError } from "../../src/errors.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { probeDurationSec } from "../../src/adapters/real/probe.ts";
import { workStates } from "../../src/adapters/real/userSchema.ts";
import {
  upsertTestWork,
  resolvedDuration,
  createWorkRepos,
  getTestWork,
  saveTestResume,
} from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function sampleWork(id: string): Work {
  const playlistId = crypto.randomUUID();
  return {
    id,
    title: id,
    cover: null,
    coverKind: "none",
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
          {
            id: crypto.randomUUID(),
            title: "first",
            file: "shared.wav",
            start: 0,
            end: 30,
            ...resolvedDuration(30),
          },
          {
            id: crypto.randomUUID(),
            title: "second",
            file: "shared.wav",
            start: 30,
            end: 90,
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

test("レジュームは区間相対秒で保存され、並べ替え後もTrack IDで復元する", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const work = sampleWork("resume-reorder");
  upsertTestWork(catalog, user, work);
  const playlist = work.playlists[0]!;
  const track = playlist.tracks[1]!;

  assert.equal(
    saveTestResume(catalog, user, work.id, {
      playlistId: playlist.id,
      trackId: track.id,
      offsetSec: 15,
    }),
    true,
  );
  assert.deepEqual((await getTestWork(db, work.id))?.resume, {
    playlistId: playlist.id,
    trackId: track.id,
    offsetSec: 15,
  });

  upsertTestWork(catalog, user, {
    ...work,
    playlists: [{ ...playlist, tracks: [playlist.tracks[1]!, playlist.tracks[0]!] }],
  });
  assert.deepEqual((await getTestWork(db, work.id))?.resume, {
    playlistId: playlist.id,
    trackId: track.id,
    offsetSec: 15,
  });
  db.close();
});

test("保存時に所属と区間を検証し、読出し時に解決不能な行だけを無効化する", async () => {
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const work = sampleWork("resume-invalid");
  upsertTestWork(catalog, user, work);
  const playlist = work.playlists[0]!;
  const track = playlist.tracks[1]!;

  assert.throws(
    () =>
      saveTestResume(catalog, user, work.id, {
        playlistId: crypto.randomUUID(),
        trackId: track.id,
        offsetSec: 1,
      }),
    InvalidResumeError,
  );
  assert.throws(
    () =>
      saveTestResume(catalog, user, work.id, {
        playlistId: playlist.id,
        trackId: track.id,
        offsetSec: 61,
      }),
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
  assert.equal((await getTestWork(db, work.id))?.resume, null);
  assert.equal(
    db.user.select().from(workStates).where(eq(workStates.workId, work.id)).get()?.resumeTrackId,
    unresolvedTrackId,
  );
  db.close();
});

test("end省略Trackは音声ファイルを300秒から60秒へ差し替えた後にoffset超過resumeを無効化する", async (t) => {
  const directory = makeTestDirectory("resume-file-replacement");
  t.after(directory.cleanup);
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const base = sampleWork("resume-probed-duration");
  const playlist = base.playlists[0]!;
  const track = { ...playlist.tracks[0]!, start: 0, end: undefined };
  const work = {
    ...base,
    physicalPath: directory.path,
    playlists: [{ ...playlist, tracks: [track] }],
  };
  upsertTestWork(catalog, user, work);
  const cachePath = join(work.physicalPath, track.file);
  writeWav(cachePath, 300);
  assert.deepEqual(await probeDurationSec(db.catalog, cachePath, new Map()), {
    kind: "resolved",
    durationSec: 300,
  });

  assert.equal(
    saveTestResume(catalog, user, work.id, {
      playlistId: playlist.id,
      trackId: track.id,
      offsetSec: 200,
    }),
    true,
  );
  assert.equal((await getTestWork(db, work.id))?.resume?.offsetSec, 200);

  writeWav(cachePath, 60);
  assert.deepEqual(await probeDurationSec(db.catalog, cachePath, new Map()), {
    kind: "resolved",
    durationSec: 60,
  });
  assert.equal((await getTestWork(db, work.id))?.resume, null);
  assert.throws(
    () =>
      saveTestResume(catalog, user, work.id, {
        playlistId: playlist.id,
        trackId: track.id,
        offsetSec: 200,
      }),
    InvalidResumeError,
  );
  db.close();
});

test("end省略Trackはrescan・明示probeなしでもgetWork読み取り時にファイル差し替えを検知する", async (t) => {
  const directory = makeTestDirectory("resume-file-replacement-live-read");
  t.after(directory.cleanup);
  const db = openDb({ kind: "memory" });
  const { catalog, user } = createWorkRepos(db);
  const base = sampleWork("resume-live-read-duration");
  const playlist = base.playlists[0]!;
  const track = { ...playlist.tracks[0]!, start: 0, end: undefined };
  const work = {
    ...base,
    physicalPath: directory.path,
    playlists: [{ ...playlist, tracks: [track] }],
  };
  upsertTestWork(catalog, user, work);
  const cachePath = join(work.physicalPath, track.file);
  writeWav(cachePath, 300);

  // getWorkの読み取りだけでprobe cacheが作られる（明示的なprobeDurationSec呼び出しはしない）。
  const first = await getTestWork(db, work.id);
  assert.equal(first?.playlists[0]?.tracks[0]?.durationSec, 300);

  // rescanを挟まずファイルだけ差し替える。
  writeWav(cachePath, 60);
  const second = await getTestWork(db, work.id);
  assert.equal(second?.playlists[0]?.tracks[0]?.durationSec, 60);
  db.close();
});
