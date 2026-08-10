import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { playlists, tracks } from "../../src/adapters/real/catalogSchema.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import {
  type SeenMetaIds,
  repairDuplicateMetaIds,
} from "../../src/adapters/real/duplicateMetaIdRepair.ts";
import { handleMetaParseError, prepareMetaEntries } from "../../src/adapters/real/scanRegister.ts";
import { createWorkRepos, getTestWork } from "../helpers/workTestUtils.ts";
import type { ScanResult } from "@mimimilli/shared";

const PLAYLIST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TRACK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NEW_OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OLD_OWNER_ID = "22222222-2222-4222-8222-222222222222";

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

function assertCatalogOwnership(
  db: ReturnType<typeof openDb>,
  playlistId: string,
  trackId: string,
  ownerWorkId: string,
  excludedWorkId: string,
): void {
  const playlistRows = db.catalog
    .select()
    .from(playlists)
    .where(eq(playlists.id, playlistId))
    .all();
  assert.equal(playlistRows.length, 1);
  assert.equal(playlistRows[0]!.workId, ownerWorkId);

  const trackRows = db.catalog.select().from(tracks).where(eq(tracks.id, trackId)).all();
  assert.equal(trackRows.length, 1);
  assert.equal(trackRows[0]!.workId, ownerWorkId);
  assert.equal(trackRows[0]!.playlistId, playlistId);

  const oldPlaylistRows = db.catalog
    .select()
    .from(playlists)
    .where(eq(playlists.workId, excludedWorkId))
    .all();
  assert.equal(
    oldPlaylistRows.some((row) => row.id === playlistId),
    false,
  );
  const oldTrackRows = db.catalog
    .select()
    .from(tracks)
    .where(eq(tracks.workId, excludedWorkId))
    .all();
  assert.equal(
    oldTrackRows.some((row) => row.id === trackId),
    false,
  );
}

test("安定順で先行する新規作品がPlaylist/Track IDを引き継いでもスキャンが完了する", async (t) => {
  const directory = makeTestDirectory("scan-ownership-transfer");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const newOwnerDir = join(root, "work-a-new");
  const oldOwnerDir = join(root, "work-z-old");
  mkdirSync(newOwnerDir, { recursive: true });
  mkdirSync(oldOwnerDir, { recursive: true });
  writeWav(join(oldOwnerDir, "track.wav"), 1);
  writeWav(join(newOwnerDir, "track.wav"), 1);

  const oldMetaPath = join(oldOwnerDir, "mimimilli.json");
  writeMetaWithIds(oldMetaPath, OLD_OWNER_ID, PLAYLIST_ID, TRACK_ID, "旧所有者");

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  const firstScan = await scanner.scan(root);
  assert.equal(firstScan.errors, 0);
  assert.equal(firstScan.registered, 1);

  const newMetaPath = join(newOwnerDir, "mimimilli.json");
  writeMetaWithIds(newMetaPath, NEW_OWNER_ID, PLAYLIST_ID, TRACK_ID, "新所有者");

  const secondScan = await scanner.scan(root);
  assert.equal(secondScan.errors, 0);
  assert.equal(secondScan.registered, 2);

  assertCatalogOwnership(db, PLAYLIST_ID, TRACK_ID, NEW_OWNER_ID, OLD_OWNER_ID);

  const oldOwner = await getTestWork(db, OLD_OWNER_ID);
  assert.equal(oldOwner?.status, "ok");
  assert.notEqual(oldOwner?.defaultPlaylistId, PLAYLIST_ID);
});

test("旧所有者が外部編集検出でerrorのままでも新所有者の登録が主キー制約違反にならない", async (t) => {
  const directory = makeTestDirectory("scan-ownership-with-error-owner");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const newOwnerDir = join(root, "work-a-new");
  const oldOwnerDir = join(root, "work-z-old");
  mkdirSync(newOwnerDir, { recursive: true });
  mkdirSync(oldOwnerDir, { recursive: true });
  writeWav(join(oldOwnerDir, "track.wav"), 1);
  writeWav(join(newOwnerDir, "track.wav"), 1);

  const oldMetaPath = join(oldOwnerDir, "mimimilli.json");
  const newMetaPath = join(newOwnerDir, "mimimilli.json");
  writeMetaWithIds(oldMetaPath, OLD_OWNER_ID, PLAYLIST_ID, TRACK_ID, "旧所有者");

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  await scanner.scan(root);

  writeMetaWithIds(newMetaPath, NEW_OWNER_ID, PLAYLIST_ID, TRACK_ID, "新所有者");

  const existingWorks = repos.query.getScanWorkMap();
  const existingByPhysicalPath = new Map(
    [...existingWorks].map(([id, state]) => [state.physicalPath, { id, state }]),
  );
  const seenIds = emptySeenIds();
  repairDuplicateMetaIds(newMetaPath, readFileSync(newMetaPath, "utf-8"), seenIds);
  const oldContent = readFileSync(oldMetaPath, "utf-8");
  let checkCalls = 0;
  const prepared = prepareMetaEntries(root, [oldMetaPath], existingWorks, true, seenIds, () => {
    checkCalls += 1;
    if (checkCalls === 2) {
      const edited = JSON.parse(oldContent);
      edited.title = "外部編集";
      writeFileSync(oldMetaPath, `${JSON.stringify(edited, null, 2)}\n`);
    }
  });
  const oldEntry = prepared.find((entry) => entry.metaPath === oldMetaPath);
  assert.equal(oldEntry?.kind, "error");

  const scanResult = emptyScanResult();
  if (oldEntry?.kind === "error") {
    handleMetaParseError(
      repos.catalog,
      oldMetaPath,
      oldEntry.error,
      seenIds,
      scanResult,
      existingWorks,
      existingByPhysicalPath,
    );
  }
  assert.equal(scanResult.errors, 1);
  const oldOwnerBefore = await getTestWork(db, OLD_OWNER_ID);
  assert.equal(oldOwnerBefore?.status, "error");
  writeFileSync(oldMetaPath, oldContent);

  const secondScan = await scanner.scan(root);
  assert.equal(secondScan.errors, 0);
  assert.equal(secondScan.registered, 2);

  assertCatalogOwnership(db, PLAYLIST_ID, TRACK_ID, NEW_OWNER_ID, OLD_OWNER_ID);

  const newOwner = await getTestWork(db, NEW_OWNER_ID);
  assert.equal(newOwner?.status, "ok");
  const oldOwner = await getTestWork(db, OLD_OWNER_ID);
  assert.equal(oldOwner?.status, "ok");
  assert.notEqual(oldOwner?.defaultPlaylistId, PLAYLIST_ID);
});
