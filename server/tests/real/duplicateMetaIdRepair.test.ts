import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import {
  type SeenMetaIds,
  repairDuplicateMetaIds,
} from "../../src/adapters/real/duplicateMetaIdRepair.ts";
import { prepareMetaEntries, handleMetaParseError } from "../../src/adapters/real/scanRegister.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createWorkRepos, getTestWork } from "../helpers/workTestUtils.ts";
import type { ScanResult } from "@mimimilli/shared";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function writeMetaWithIds(
  path: string,
  workId: string,
  playlistId: string,
  trackId: string,
  title: string,
): void {
  writeFileSync(
    path,
    JSON.stringify(
      {
        id: workId,
        title,
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "本編", file: "track.wav" }],
          },
        ],
        defaultPlaylistId: playlistId,
      },
      null,
      2,
    ),
  );
}

function emptySeenIds(): SeenMetaIds {
  return { work: new Set(), playlist: new Set(), track: new Set() };
}

function emptyScanResult(): ScanResult {
  return {
    registered: 0,
    newlyGenerated: 0,
    errors: 0,
    missing: 0,
    newWorkIds: [],
    rjCodeMissingCount: 0,
    skipped: 0,
    coverErrors: 0,
  };
}

test("正規化パスの安定順でPlaylist/Track IDの最初の所有者を決める", (t) => {
  const directory = makeTestDirectory("duplicate-id-stable-owner");
  t.after(directory.cleanup);
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const paths = ["work-a", "work-b"].map((name, index) => {
    const workDir = join(directory.path, name);
    const metaPath = join(workDir, "mimimilli.json");
    mkdirSync(workDir, { recursive: true });
    writeMetaWithIds(
      metaPath,
      index === 0 ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
      playlistId,
      trackId,
      name,
    );
    return metaPath;
  });

  const seenIds = emptySeenIds();
  for (const metaPath of paths) {
    const content = readFileSync(metaPath, "utf-8");
    repairDuplicateMetaIds(metaPath, content, seenIds);
  }

  const first = JSON.parse(readFileSync(paths[0]!, "utf-8"));
  const second = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  assert.equal(first.playlists[0].id, playlistId);
  assert.equal(first.playlists[0].tracks[0].id, trackId);
  assert.equal(second.id, "22222222-2222-4222-8222-222222222222");
  assert.notEqual(second.playlists[0].id, playlistId);
  assert.notEqual(second.playlists[0].tracks[0].id, trackId);
  assert.equal(second.defaultPlaylistId, second.playlists[0].id);
});

test("外部編集で重複IDになった作品が混在しても重複を見逃さず再採番する", (t) => {
  const directory = makeTestDirectory("duplicate-id-reassign");
  t.after(directory.cleanup);
  const paths = ["work-a", "work-b"].map((name, index) => {
    const workDir = join(directory.path, name);
    const metaPath = join(workDir, "mimimilli.json");
    mkdirSync(workDir, { recursive: true });
    writeMetaWithIds(
      metaPath,
      index === 0 ? "11111111-1111-4111-8111-111111111111" : "22222222-2222-4222-8222-222222222222",
      `33333333-3333-4333-8333-3333333333${index}`,
      `44444444-4444-4444-8444-4444444444${index}`,
      name,
    );
    return metaPath;
  });

  const seenIds = emptySeenIds();
  for (const metaPath of paths) {
    repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);
  }
  const migratedA = JSON.parse(readFileSync(paths[0]!, "utf-8"));

  const corrupted = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  corrupted.id = migratedA.id;
  corrupted.playlists[0].id = migratedA.playlists[0].id;
  corrupted.playlists[0].tracks[0].id = migratedA.playlists[0].tracks[0].id;
  writeFileSync(paths[1]!, `${JSON.stringify(corrupted, null, 2)}\n`);

  const repair = repairDuplicateMetaIds(paths[1]!, readFileSync(paths[1]!, "utf-8"), seenIds);
  assert.equal(repair.externallyModified, false);
  assert.equal(repair.repaired, true);

  const reassignedA = JSON.parse(readFileSync(paths[0]!, "utf-8"));
  const reassignedB = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  assert.deepEqual(reassignedA, migratedA);
  assert.notEqual(reassignedB.id, reassignedA.id);
  assert.notEqual(reassignedB.playlists[0].id, reassignedA.playlists[0].id);
  assert.notEqual(reassignedB.playlists[0].tracks[0].id, reassignedA.playlists[0].tracks[0].id);
});

test("修復直前に外部編集されたメタは上書きしない", (t) => {
  const directory = makeTestDirectory("duplicate-id-external-edit");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  writeMetaWithIds(
    metaPath,
    "11111111-1111-4111-8111-111111111111",
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "作品",
  );

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);

  const staleContent = readFileSync(metaPath, "utf-8");
  const duplicate = JSON.parse(staleContent);
  duplicate.id = "22222222-2222-4222-8222-222222222222";
  duplicate.playlists[0].id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  duplicate.playlists[0].tracks[0].id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  duplicate.title = "外部編集済み";
  const duplicateContent = `${JSON.stringify(duplicate, null, 2)}\n`;
  writeFileSync(metaPath, duplicateContent);

  const result = repairDuplicateMetaIds(metaPath, staleContent, seenIds);
  assert.equal(result.externallyModified, true);
  assert.equal(result.repaired, false);
  assert.equal(readFileSync(metaPath, "utf-8"), duplicateContent);
});

test("スキャンはレガシーメタを自動変換せずファイルを変更しない", async (t) => {
  const directory = makeTestDirectory("legacy-meta-no-migration");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const workDir = join(root, "legacy-work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  const legacy = JSON.stringify(
    {
      id: "11111111-1111-4111-8111-111111111111",
      title: "レガシー作品",
      playlists: [
        {
          name: "default",
          tracks: [{ title: "本編", file: "track.wav" }],
        },
      ],
      defaultPlaylist: "default",
    },
    null,
    2,
  );
  writeFileSync(metaPath, legacy);

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  const result = await adapter.scan();

  assert.equal(readFileSync(metaPath, "utf-8"), legacy);
  assert.equal(result.errors, 1);
  assert.equal(result.registered, 0);
});

function writeMetaObject(path: string, meta: Record<string, unknown>): void {
  writeFileSync(path, `${JSON.stringify(meta, null, 2)}\n`);
}

test("同一メタ内のPlaylist ID重複は後続を再採番しdefaultPlaylistIdは先頭を維持", (t) => {
  const directory = makeTestDirectory("duplicate-playlist-in-meta");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  const duplicatePlaylistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const trackB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  writeMetaObject(metaPath, {
    id: "11111111-1111-4111-8111-111111111111",
    title: "作品",
    playlists: [
      {
        id: duplicatePlaylistId,
        name: "先頭",
        tracks: [{ id: trackA, title: "t1", file: "track.wav" }],
      },
      {
        id: duplicatePlaylistId,
        name: "後続",
        tracks: [{ id: trackB, title: "t2", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: duplicatePlaylistId,
  });

  const seenIds = emptySeenIds();
  const result = repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);
  assert.equal(result.repaired, true);

  const repaired = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(repaired.playlists[0].id, duplicatePlaylistId);
  assert.notEqual(repaired.playlists[1].id, duplicatePlaylistId);
  assert.equal(repaired.defaultPlaylistId, duplicatePlaylistId);
});

test("Work ID既出時もdefaultPlaylistIdは先頭の重複Playlistの新IDを指す", (t) => {
  const directory = makeTestDirectory("duplicate-work-default-playlist");
  t.after(directory.cleanup);
  const ownerPath = join(directory.path, "work-owner", "mimimilli.json");
  const duplicatePath = join(directory.path, "work-duplicate", "mimimilli.json");
  mkdirSync(dirname(ownerPath), { recursive: true });
  mkdirSync(dirname(duplicatePath), { recursive: true });

  const workId = "11111111-1111-4111-8111-111111111111";
  const duplicatePlaylistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackA = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const trackB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  writeMetaObject(ownerPath, {
    id: workId,
    title: "所有者",
    playlists: [
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        name: "default",
        tracks: [{ id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", title: "t", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  });
  writeMetaObject(duplicatePath, {
    id: workId,
    title: "重複",
    playlists: [
      {
        id: duplicatePlaylistId,
        name: "先頭",
        tracks: [{ id: trackA, title: "t1", file: "track.wav" }],
      },
      {
        id: duplicatePlaylistId,
        name: "後続",
        tracks: [{ id: trackB, title: "t2", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: duplicatePlaylistId,
  });

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(ownerPath, readFileSync(ownerPath, "utf-8"), seenIds);
  const result = repairDuplicateMetaIds(
    duplicatePath,
    readFileSync(duplicatePath, "utf-8"),
    seenIds,
  );
  assert.equal(result.repaired, true);

  const repaired = JSON.parse(readFileSync(duplicatePath, "utf-8"));
  assert.notEqual(repaired.id, workId);
  assert.notEqual(repaired.playlists[0].id, repaired.playlists[1].id);
  assert.equal(repaired.defaultPlaylistId, repaired.playlists[0].id);
  assert.notEqual(repaired.defaultPlaylistId, repaired.playlists[1].id);
});

test("同一メタ内のTrack ID重複は同一Playlist内で後続を再採番する", (t) => {
  const directory = makeTestDirectory("duplicate-track-same-playlist");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const duplicateTrackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeMetaObject(metaPath, {
    id: "11111111-1111-4111-8111-111111111111",
    title: "作品",
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          { id: duplicateTrackId, title: "先頭", file: "a.wav" },
          { id: duplicateTrackId, title: "後続", file: "b.wav" },
        ],
      },
    ],
    defaultPlaylistId: playlistId,
  });

  const seenIds = emptySeenIds();
  const result = repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);
  assert.equal(result.repaired, true);

  const repaired = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(repaired.playlists[0].tracks[0].id, duplicateTrackId);
  assert.notEqual(repaired.playlists[0].tracks[1].id, duplicateTrackId);
});

test("同一メタ内のTrack ID重複は異なるPlaylist間でも後続を再採番する", (t) => {
  const directory = makeTestDirectory("duplicate-track-cross-playlist");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  const playlistA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const playlistB = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const duplicateTrackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeMetaObject(metaPath, {
    id: "11111111-1111-4111-8111-111111111111",
    title: "作品",
    playlists: [
      {
        id: playlistA,
        name: "A",
        tracks: [{ id: duplicateTrackId, title: "先頭", file: "a.wav" }],
      },
      {
        id: playlistB,
        name: "B",
        tracks: [{ id: duplicateTrackId, title: "後続", file: "b.wav" }],
      },
    ],
    defaultPlaylistId: playlistA,
  });

  const seenIds = emptySeenIds();
  const result = repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);
  assert.equal(result.repaired, true);

  const repaired = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(repaired.playlists[0].tracks[0].id, duplicateTrackId);
  assert.notEqual(repaired.playlists[1].tracks[0].id, duplicateTrackId);
});

test("修復書込み直前の再読込みで外部編集を検出する", (t) => {
  const directory = makeTestDirectory("external-edit-before-write");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  const workId = "11111111-1111-4111-8111-111111111111";
  writeMetaWithIds(
    metaPath,
    workId,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "作品",
  );

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);

  const duplicate = JSON.parse(readFileSync(metaPath, "utf-8"));
  duplicate.id = "22222222-2222-4222-8222-222222222222";
  duplicate.playlists[0].id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  duplicate.playlists[0].tracks[0].id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  duplicate.defaultPlaylistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  duplicate.title = "外部編集済み";
  const duplicateContent = `${JSON.stringify(duplicate, null, 2)}\n`;
  writeFileSync(metaPath, duplicateContent);

  let checkCalls = 0;
  const result = repairDuplicateMetaIds(metaPath, duplicateContent, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 2) {
      writeFileSync(metaPath, `${JSON.stringify({ ...duplicate, title: "競合" }, null, 2)}\n`);
    }
  });
  assert.equal(result.externallyModified, true);
  assert.equal(result.repaired, false);
  assert.match(readFileSync(metaPath, "utf-8"), /競合/);
});

test("rename直前の再確認で外部編集を検出する", (t) => {
  const directory = makeTestDirectory("external-edit-before-rename");
  t.after(directory.cleanup);
  const metaPath = join(directory.path, "work", "mimimilli.json");
  mkdirSync(dirname(metaPath), { recursive: true });
  const workId = "11111111-1111-4111-8111-111111111111";
  writeMetaWithIds(
    metaPath,
    workId,
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "作品",
  );

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(metaPath, readFileSync(metaPath, "utf-8"), seenIds);

  const duplicate = JSON.parse(readFileSync(metaPath, "utf-8"));
  duplicate.id = "22222222-2222-4222-8222-222222222222";
  duplicate.playlists[0].id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  duplicate.playlists[0].tracks[0].id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  duplicate.defaultPlaylistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const duplicateContent = `${JSON.stringify(duplicate, null, 2)}\n`;
  writeFileSync(metaPath, duplicateContent);

  let checkCalls = 0;
  const result = repairDuplicateMetaIds(metaPath, duplicateContent, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 3) {
      writeFileSync(
        metaPath,
        `${JSON.stringify({ ...duplicate, title: "rename前競合" }, null, 2)}\n`,
      );
    }
  });
  assert.equal(result.externallyModified, true);
  assert.equal(result.repaired, false);
  assert.match(readFileSync(metaPath, "utf-8"), /rename前競合/);
});

test("外部編集検出時はprepareMetaEntriesが登録せずエラー扱いにする", (t) => {
  const directory = makeTestDirectory("prepare-skip-external-edit");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const goodPath = join(root, "work-good", "mimimilli.json");
  const badPath = join(root, "work-bad", "mimimilli.json");
  mkdirSync(dirname(goodPath), { recursive: true });
  mkdirSync(dirname(badPath), { recursive: true });
  writeWav(join(root, "work-good", "track.wav"), 1);
  writeWav(join(root, "work-bad", "track.wav"), 1);

  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeMetaWithIds(goodPath, "11111111-1111-4111-8111-111111111111", playlistId, trackId, "正常");
  writeMetaWithIds(badPath, "22222222-2222-4222-8222-222222222222", playlistId, trackId, "競合");

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(goodPath, readFileSync(goodPath, "utf-8"), seenIds);

  const badContent = readFileSync(badPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(root, [badPath], new Map(), true, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 2) {
      const edited = JSON.parse(badContent);
      edited.title = "外部編集";
      writeFileSync(badPath, `${JSON.stringify(edited, null, 2)}\n`);
    }
  });

  assert.equal(prepared.length, 1);
  const bad = prepared[0];
  assert.equal(bad?.kind, "error");
  assert.match(bad?.kind === "error" ? bad.error.message : "", /外部編集/);
  assert.equal(
    bad?.kind === "error" ? bad.error.candidateId : null,
    "22222222-2222-4222-8222-222222222222",
  );
});
test("外部編集検出後もseenIdsを汚染せず後続メタを誤再採番しない", (t) => {
  const directory = makeTestDirectory("seen-ids-not-polluted");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const ownerPath = join(root, "work-owner", "mimimilli.json");
  const conflictPath = join(root, "work-conflict", "mimimilli.json");
  const followerPath = join(root, "work-follower", "mimimilli.json");
  for (const workDir of ["work-owner", "work-conflict", "work-follower"]) {
    mkdirSync(join(root, workDir), { recursive: true });
    writeWav(join(root, workDir, "track.wav"), 1);
  }

  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  writeMetaWithIds(
    ownerPath,
    "11111111-1111-4111-8111-111111111111",
    playlistId,
    trackId,
    "所有者",
  );
  writeMetaWithIds(
    conflictPath,
    "22222222-2222-4222-8222-222222222222",
    playlistId,
    trackId,
    "競合",
  );
  writeMetaWithIds(
    followerPath,
    "33333333-3333-4333-8333-333333333333",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    "後続",
  );

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(ownerPath, readFileSync(ownerPath, "utf-8"), seenIds);

  const conflictContent = readFileSync(conflictPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(
    root,
    [conflictPath, followerPath],
    new Map(),
    true,
    seenIds,
    () => {
      checkCalls += 1;
      if (checkCalls === 2) {
        const edited = JSON.parse(conflictContent);
        edited.title = "外部編集";
        writeFileSync(conflictPath, `${JSON.stringify(edited, null, 2)}\n`);
      }
    },
  );

  assert.equal(prepared.find((entry) => entry.metaPath === conflictPath)?.kind, "error");
  const follower = prepared.find((entry) => entry.metaPath === followerPath);
  assert.equal(follower?.kind, "ok");
  assert.equal(
    follower?.kind === "ok" ? follower.meta.id : null,
    "33333333-3333-4333-8333-333333333333",
  );
  assert.equal(
    follower?.kind === "ok" ? follower.meta.playlists[0]?.id : null,
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  );
});

test("外部編集検出後の次回スキャンで重複を修復して登録する", async (t) => {
  const directory = makeTestDirectory("rescan-after-external-edit");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const ownerDir = join(root, "work-a-owner");
  const conflictDir = join(root, "work-z-conflict");
  mkdirSync(ownerDir, { recursive: true });
  mkdirSync(conflictDir, { recursive: true });
  writeWav(join(ownerDir, "track.wav"), 1);
  writeWav(join(conflictDir, "track.wav"), 1);

  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ownerMetaPath = join(ownerDir, "mimimilli.json");
  const conflictMetaPath = join(conflictDir, "mimimilli.json");
  writeMetaWithIds(
    ownerMetaPath,
    "11111111-1111-4111-8111-111111111111",
    playlistId,
    trackId,
    "所有者",
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  writeMetaWithIds(
    conflictMetaPath,
    "22222222-2222-4222-8222-222222222222",
    playlistId,
    trackId,
    "競合",
  );

  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(ownerMetaPath, readFileSync(ownerMetaPath, "utf-8"), seenIds);
  const conflictContent = readFileSync(conflictMetaPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(root, [conflictMetaPath], new Map(), true, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 2) {
      const edited = JSON.parse(conflictContent);
      edited.title = "外部編集";
      writeFileSync(conflictMetaPath, `${JSON.stringify(edited, null, 2)}\n`);
    }
  });
  const conflictEntry = prepared.find((entry) => entry.metaPath === conflictMetaPath);
  assert.equal(conflictEntry?.kind, "error");
  writeFileSync(conflictMetaPath, conflictContent);

  const secondScan = await adapter.scan();
  assert.equal(secondScan.errors, 0);
  assert.equal(secondScan.registered, 1);
  const repairedConflict = JSON.parse(readFileSync(conflictMetaPath, "utf-8"));
  assert.notEqual(repairedConflict.playlists[0].id, playlistId);
  const conflictAfter = await adapter.getWork(repairedConflict.id);
  assert.equal(conflictAfter?.status, "ok");
});

test("外部編集検出時は既存作品をerrorにし次回スキャンで復帰する", async (t) => {
  const directory = makeTestDirectory("rescan-existing-work-error");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const ownerDir = join(root, "work-a-owner");
  const conflictDir = join(root, "work-z-conflict");
  mkdirSync(ownerDir, { recursive: true });
  mkdirSync(conflictDir, { recursive: true });
  writeWav(join(ownerDir, "track.wav"), 1);
  writeWav(join(conflictDir, "track.wav"), 1);

  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const conflictPlaylistId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const conflictTrackId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const ownerMetaPath = join(ownerDir, "mimimilli.json");
  const conflictMetaPath = join(conflictDir, "mimimilli.json");
  const conflictWorkId = "22222222-2222-4222-8222-222222222222";
  writeMetaWithIds(
    ownerMetaPath,
    "11111111-1111-4111-8111-111111111111",
    playlistId,
    trackId,
    "所有者",
  );
  writeMetaWithIds(conflictMetaPath, conflictWorkId, conflictPlaylistId, conflictTrackId, "競合");

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  await scanner.scan(root);

  const conflictMeta = JSON.parse(readFileSync(conflictMetaPath, "utf-8"));
  conflictMeta.playlists[0].id = playlistId;
  conflictMeta.playlists[0].tracks[0].id = trackId;
  conflictMeta.defaultPlaylistId = playlistId;
  writeFileSync(conflictMetaPath, `${JSON.stringify(conflictMeta, null, 2)}\n`);

  const existingWorks = repos.query.getScanWorkMap();
  const existingByPhysicalPath = new Map(
    [...existingWorks].map(([id, state]) => [state.physicalPath, { id, state }]),
  );
  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(ownerMetaPath, readFileSync(ownerMetaPath, "utf-8"), seenIds);
  const conflictContent = readFileSync(conflictMetaPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(
    root,
    [conflictMetaPath],
    existingWorks,
    true,
    seenIds,
    () => {
      checkCalls += 1;
      if (checkCalls === 2) {
        const edited = JSON.parse(conflictContent);
        edited.title = "外部編集";
        writeFileSync(conflictMetaPath, `${JSON.stringify(edited, null, 2)}\n`);
      }
    },
  );
  const conflictEntry = prepared.find((entry) => entry.metaPath === conflictMetaPath);
  assert.equal(conflictEntry?.kind, "error");

  const scanResult = emptyScanResult();
  if (conflictEntry?.kind === "error") {
    handleMetaParseError(
      repos.catalog,
      conflictMetaPath,
      conflictEntry.error,
      seenIds,
      scanResult,
      existingWorks,
      existingByPhysicalPath,
    );
  }
  assert.equal(scanResult.errors, 1);
  const conflictWork = await getTestWork(db, conflictWorkId);
  assert.equal(conflictWork?.status, "error");
  assert.match(conflictWork?.errorMessage ?? "", /外部編集/);
  writeFileSync(conflictMetaPath, conflictContent);

  const recoveredScan = await scanner.scan(root);
  assert.equal(recoveredScan.errors, 0);
  assert.equal((await getTestWork(db, conflictWorkId))?.status, "ok");
});

test("外部編集検出時は新規作品をerrorsに計上する", (t) => {
  const directory = makeTestDirectory("external-edit-new-work-errors");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const ownerDir = join(root, "work-owner");
  const newDir = join(root, "work-new");
  mkdirSync(ownerDir, { recursive: true });
  mkdirSync(newDir, { recursive: true });
  writeWav(join(ownerDir, "track.wav"), 1);
  writeWav(join(newDir, "track.wav"), 1);

  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const ownerMetaPath = join(ownerDir, "mimimilli.json");
  const newMetaPath = join(newDir, "mimimilli.json");
  writeMetaWithIds(
    ownerMetaPath,
    "11111111-1111-4111-8111-111111111111",
    playlistId,
    trackId,
    "所有者",
  );
  writeMetaWithIds(
    newMetaPath,
    "22222222-2222-4222-8222-222222222222",
    playlistId,
    trackId,
    "新規",
  );

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const existingWorks = repos.query.getScanWorkMap();
  const existingByPhysicalPath = new Map(
    [...existingWorks].map(([id, state]) => [state.physicalPath, { id, state }]),
  );
  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(ownerMetaPath, readFileSync(ownerMetaPath, "utf-8"), seenIds);
  const newContent = readFileSync(newMetaPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(root, [newMetaPath], existingWorks, true, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 2) {
      const edited = JSON.parse(newContent);
      edited.title = "外部編集";
      writeFileSync(newMetaPath, `${JSON.stringify(edited, null, 2)}\n`);
    }
  });
  const newEntry = prepared.find((entry) => entry.metaPath === newMetaPath);
  assert.equal(newEntry?.kind, "error");

  const scanResult = emptyScanResult();
  if (newEntry?.kind === "error") {
    handleMetaParseError(
      repos.catalog,
      newMetaPath,
      newEntry.error,
      seenIds,
      scanResult,
      existingWorks,
      existingByPhysicalPath,
    );
  }
  assert.equal(scanResult.errors, 1);
});
