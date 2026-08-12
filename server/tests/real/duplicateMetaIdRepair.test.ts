import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import {
  type SeenMetaIds,
  repairDuplicateMetaIds,
} from "../../src/adapters/real/duplicateMetaIdRepair.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const WORK_A = "11111111-1111-4111-8111-111111111111";
const WORK_B = "22222222-2222-4222-8222-222222222222";
const PLAYLIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function emptySeenIds(): SeenMetaIds {
  return { work: new Set() };
}

function writeMeta(path: string, value: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function singlePlaylist(workId: string): Record<string, unknown> {
  return {
    formatVersion: 1,
    id: workId,
    title: "作品",
    playlists: [
      {
        id: PLAYLIST_ID,
        name: "default",
        tracks: [{ id: TRACK_ID, title: "本編", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: PLAYLIST_ID,
  };
}

test("異なるWork間で同じPlaylist/Track IDがあってもsidecarを書き換えない", (t) => {
  const directory = makeTestDirectory("duplicate-ids-across-works");
  t.after(directory.cleanup);
  const first = join(directory.path, "first", "mimimilli.json");
  const second = join(directory.path, "second", "mimimilli.json");
  writeMeta(first, singlePlaylist(WORK_A));
  writeMeta(second, singlePlaylist(WORK_B));
  const before = readFileSync(second, "utf-8");

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(first, readFileSync(first, "utf-8"), seenIds);
  const result = repairDuplicateMetaIds(second, before, seenIds);

  assert.equal(result.repaired, false);
  assert.equal(readFileSync(second, "utf-8"), before);
});

test("同一sidecarのPlaylist ID重複は後続だけを修復しdefaultPlaylistIdを保つ", (t) => {
  const directory = makeTestDirectory("duplicate-playlist-in-meta");
  t.after(directory.cleanup);
  const path = join(directory.path, "work", "mimimilli.json");
  const meta = singlePlaylist(WORK_A);
  const playlists = meta.playlists as Array<Record<string, unknown>>;
  playlists.push({
    id: PLAYLIST_ID,
    name: "後続",
    tracks: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title: "t2", file: "b.wav" }],
  });
  writeMeta(path, meta);

  assert.equal(
    repairDuplicateMetaIds(path, readFileSync(path, "utf-8"), emptySeenIds()).repaired,
    true,
  );
  const repaired = JSON.parse(readFileSync(path, "utf-8"));
  assert.equal(repaired.playlists[0].id, PLAYLIST_ID);
  assert.notEqual(repaired.playlists[1].id, PLAYLIST_ID);
  assert.equal(repaired.defaultPlaylistId, PLAYLIST_ID);
});

test("同一sidecarのTrack ID重複は後続だけを修復する", (t) => {
  const directory = makeTestDirectory("duplicate-track-in-meta");
  t.after(directory.cleanup);
  const path = join(directory.path, "work", "mimimilli.json");
  const meta = singlePlaylist(WORK_A);
  const playlists = meta.playlists as Array<Record<string, unknown>>;
  const tracks = playlists[0]!.tracks as Array<Record<string, unknown>>;
  tracks.push({ id: TRACK_ID, title: "後続", file: "b.wav" });
  writeMeta(path, meta);

  assert.equal(
    repairDuplicateMetaIds(path, readFileSync(path, "utf-8"), emptySeenIds()).repaired,
    true,
  );
  const repaired = JSON.parse(readFileSync(path, "utf-8"));
  assert.equal(repaired.playlists[0].tracks[0].id, TRACK_ID);
  assert.notEqual(repaired.playlists[0].tracks[1].id, TRACK_ID);
});

test("同一sidecarの修復前に外部編集があれば上書きしない", (t) => {
  const directory = makeTestDirectory("duplicate-local-external-edit");
  t.after(directory.cleanup);
  const path = join(directory.path, "work", "mimimilli.json");
  const meta = singlePlaylist(WORK_A);
  const playlists = meta.playlists as Array<Record<string, unknown>>;
  playlists.push(structuredClone(playlists[0]!));
  writeMeta(path, meta);
  const stale = readFileSync(path, "utf-8");
  const edited = `${JSON.stringify({ ...meta, title: "外部編集" }, null, 2)}\n`;
  writeFileSync(path, edited);

  const result = repairDuplicateMetaIds(path, stale, emptySeenIds());
  assert.equal(result.externallyModified, true);
  assert.equal(readFileSync(path, "utf-8"), edited);
});
