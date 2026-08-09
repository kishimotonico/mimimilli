import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import {
  type SeenMetaIds,
  repairDuplicateMetaIds,
} from "../../src/adapters/real/duplicateMetaIdRepair.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

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
