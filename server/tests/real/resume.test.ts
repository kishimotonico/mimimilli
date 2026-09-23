import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import type { Work } from "@mimimilli/shared";
import { eq } from "drizzle-orm";
import { InvalidResumeError } from "../../src/errors.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { fetchProbeCache, probeDurationSec } from "../../src/adapters/real/probe.ts";
import { getWorkWithLiveProbe } from "../../src/adapters/real/workRefresh.ts";
import { workStates } from "../../src/adapters/real/userSchema.ts";
import {
  upsertTestWork,
  makeWork,
  resolvedDuration,
  createWorkRepos,
  getTestWork,
  saveTestResume,
} from "../helpers/workTestUtils.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function sampleWork(id: string): Work {
  const playlistId = crypto.randomUUID();
  return makeWork({
    id,
    title: id,
    totalDurationSec: 90,
    defaultPlaylistId: playlistId,
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
  });
}

test("レジュームは区間相対秒で保存され、並べ替え後もTrack IDで復元する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
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
});

test("保存時に所属と区間を検証し、読出し時に解決不能な行だけを無効化する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
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
});

test("end省略Trackは音声ファイルを300秒から60秒へ差し替えた後にoffset超過resumeを無効化する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const directory = makeTestDirectory("resume-file-replacement");
  t.after(directory.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
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
});

test("end省略Trackのファイル差し替え後もgetWorkはprobe cacheを書かず保存列を変えない", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const directory = makeTestDirectory("resume-file-replacement-get-no-write");
  t.after(directory.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const base = sampleWork("resume-get-no-write");
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

  assert.equal((await getTestWork(db, work.id))?.playlists[0]?.tracks[0]?.durationSec, null);
  assert.equal(fetchProbeCache(db, [cachePath]).size, 0);

  const prepared = await getWorkWithLiveProbe(db, query, catalog, work.id);
  assert.equal(prepared?.playlists[0]?.tracks[0]?.durationSec, 300);
  const cached = fetchProbeCache(db, [cachePath]).get(cachePath);
  assert.ok(cached);
  const cachedSize = cached.size;
  const cachedMtime = cached.mtimeMs;

  writeWav(cachePath, 60);
  const afterGet = await getTestWork(db, work.id);
  assert.equal(afterGet?.playlists[0]?.tracks[0]?.durationSec, 300);
  const afterCache = fetchProbeCache(db, [cachePath]).get(cachePath);
  assert.equal(afterCache?.size, cachedSize);
  assert.equal(afterCache?.mtimeMs, cachedMtime);
  assert.equal(afterCache?.durationSec, 300);
});

test("end省略Trackのファイル差し替え後、prepareWorkPlaybackはprobe cacheとdurationを更新する", async (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const directory = makeTestDirectory("resume-file-replacement-prepare");
  t.after(directory.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  const base = sampleWork("resume-prepare-duration");
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
  await getWorkWithLiveProbe(db, query, catalog, work.id);

  writeWav(cachePath, 60);
  const prepared = await getWorkWithLiveProbe(db, query, catalog, work.id);
  assert.equal(prepared?.playlists[0]?.tracks[0]?.durationSec, 60);
  assert.equal(fetchProbeCache(db, [cachePath]).get(cachePath)?.durationSec, 60);
  assert.equal((await getTestWork(db, work.id))?.playlists[0]?.tracks[0]?.durationSec, 60);
});
