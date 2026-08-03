import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { metaFileSchema } from "@mimimilli/shared";
import { migrateMetaIds } from "../../src/adapters/real/metaIdMigration.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function writeLegacyMeta(path: string, title = "旧メタ"): void {
  writeFileSync(
    path,
    JSON.stringify({
      id: "11111111-1111-4111-8111-111111111111",
      title,
      playlists: [
        {
          name: "default",
          tracks: [{ title: "本編", file: "track.wav" }],
        },
      ],
      defaultPlaylist: "default",
    }),
  );
}

test("manifest先行採番: 書換え前に停止しても再実行で同じIDを使う", (t) => {
  const directory = makeTestDirectory("meta-id-interrupt");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeLegacyMeta(metaPath);
  const original = readFileSync(metaPath, "utf-8");

  const stopped = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot, maxWrites: 0 });
  assert.equal(stopped.migrated, 0);
  const migrationsRoot = join(dataRoot, "migrations", "playlist-track-ids");
  const rootKeys = readdirSync(migrationsRoot);
  assert.equal(rootKeys.length, 1);
  const operationRoot = join(migrationsRoot, rootKeys[0]!);
  const manifest = JSON.parse(readFileSync(join(operationRoot, "manifest.json"), "utf-8"));
  const assignment = manifest.operations[0];

  const resumed = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });
  assert.equal(resumed.migrated, 1);
  const migrated = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(migrated.id, assignment.workId);
  assert.equal(migrated.playlists[0].id, assignment.playlistIds[0]);
  assert.equal(migrated.playlists[0].tracks[0].id, assignment.trackIds[0][0]);
  assert.equal(migrated.defaultPlaylistId, assignment.defaultPlaylistId);
  assert.equal("defaultPlaylist" in migrated, false);

  writeFileSync(metaPath, original);
  const restored = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });
  assert.equal(restored.migrated, 1);
  const reapplied = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(reapplied.playlists[0].id, assignment.playlistIds[0]);
  assert.equal(reapplied.playlists[0].tracks[0].id, assignment.trackIds[0][0]);

  let metaHashCount = 0;
  const third = migrateMetaIds({
    root,
    metaPaths: [metaPath],
    dataRoot,
    onMetaHash: () => {
      metaHashCount += 1;
    },
  });
  assert.equal(third.migrated, 0);
  assert.equal(metaHashCount, 0);
  const editedAfterCompletion = readFileSync(metaPath, "utf-8").replace("旧メタ", "移行後編集");
  writeFileSync(metaPath, editedAfterCompletion);
  const afterCompletion = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });
  assert.deepEqual(afterCompletion.externallyModified, []);
  assert.equal(readFileSync(metaPath, "utf-8"), editedAfterCompletion);
  const backupHashes = readdirSync(join(operationRoot, "backup"));
  assert.equal(backupHashes.length, 1);
  assert.equal(
    existsSync(join(operationRoot, "backup", backupHashes[0]!, "work", "mimimilli.json")),
    true,
  );
});

test("manifest作成後に外部編集されたメタは上書きしない", (t) => {
  const directory = makeTestDirectory("meta-id-external-edit");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeLegacyMeta(metaPath);
  migrateMetaIds({ root, metaPaths: [metaPath], dataRoot, maxWrites: 0 });

  const edited = readFileSync(metaPath, "utf-8").replace("旧メタ", "外部編集済み");
  writeFileSync(metaPath, edited);
  const result = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });

  assert.deepEqual(result.externallyModified, ["work/mimimilli.json"]);
  assert.equal(readFileSync(metaPath, "utf-8"), edited);
  assert.equal(existsSync(join(workDir, "mimimilli.json")), true);
});

test("rename直前に外部編集されたメタは再ハッシュで検出して上書きしない", (t) => {
  const directory = makeTestDirectory("meta-id-final-hash");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeLegacyMeta(metaPath);

  const result = migrateMetaIds({
    root,
    metaPaths: [metaPath],
    dataRoot,
    beforeFinalHashCheck: (path) => {
      const edited = readFileSync(path, "utf-8").replace("旧メタ", "rename直前の外部編集");
      writeFileSync(path, edited);
    },
  });

  assert.equal(result.migrated, 0);
  assert.deepEqual(result.externallyModified, ["work/mimimilli.json"]);
  assert.match(readFileSync(metaPath, "utf-8"), /rename直前の外部編集/);
});

test("正規化パスの安定順でPlaylist/Track IDの最初の所有者を決める", (t) => {
  const directory = makeTestDirectory("meta-id-stable-owner");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const trackId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const paths = ["work-a", "work-b"].map((name, index) => {
    const workDir = join(root, name);
    const metaPath = join(workDir, "mimimilli.json");
    mkdirSync(workDir, { recursive: true });
    writeFileSync(
      metaPath,
      JSON.stringify({
        id:
          index === 0
            ? "11111111-1111-4111-8111-111111111111"
            : "22222222-2222-4222-8222-222222222222",
        title: name,
        playlists: [
          {
            id: playlistId,
            name: "default",
            tracks: [{ id: trackId, title: "本編", file: "track.wav" }],
          },
        ],
        defaultPlaylistId: playlistId,
      }),
    );
    return metaPath;
  });

  migrateMetaIds({ root, metaPaths: [...paths].reverse(), dataRoot });
  const first = JSON.parse(readFileSync(paths[0]!, "utf-8"));
  const second = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  assert.equal(first.playlists[0].id, playlistId);
  assert.equal(first.playlists[0].tracks[0].id, trackId);
  assert.equal(second.id, "22222222-2222-4222-8222-222222222222");
  assert.notEqual(second.playlists[0].id, playlistId);
  assert.notEqual(second.playlists[0].tracks[0].id, trackId);
  assert.equal(second.defaultPlaylistId, second.playlists[0].id);
});

test("旧メタの同名PlaylistをID付きへ移行して厳格スキーマで読める", (t) => {
  const directory = makeTestDirectory("meta-id-same-name");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeFileSync(
    metaPath,
    JSON.stringify({
      id: "11111111-1111-4111-8111-111111111111",
      title: "同名プレイリスト",
      playlists: [
        { name: "同名", tracks: [{ title: "A", file: "a.wav" }] },
        { name: "同名", tracks: [{ title: "B", file: "b.wav" }] },
      ],
      defaultPlaylist: "同名",
    }),
  );

  assert.equal(migrateMetaIds({ root, metaPaths: [metaPath], dataRoot }).migrated, 1);
  const migrated = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(metaFileSchema.safeParse(migrated).success, true);
  assert.equal(migrated.playlists[0].name, migrated.playlists[1].name);
  assert.notEqual(migrated.playlists[0].id, migrated.playlists[1].id);
  assert.equal(migrated.defaultPlaylistId, migrated.playlists[0].id);
});

function readManifestFile(dataRoot: string): Record<string, unknown> {
  const migrationsRoot = join(dataRoot, "migrations", "playlist-track-ids");
  const operationRoot = join(migrationsRoot, readdirSync(migrationsRoot)[0]!);
  return JSON.parse(readFileSync(join(operationRoot, "manifest.json"), "utf-8"));
}

test("完了済みライブラリでは変更がなければ fast path で早期 return する", (t) => {
  const directory = makeTestDirectory("meta-id-fast-path");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const paths = ["work-a", "work-b"].map((name, index) => {
    const workDir = join(root, name);
    const metaPath = join(workDir, "mimimilli.json");
    mkdirSync(workDir, { recursive: true });
    writeLegacyMeta(metaPath, index === 0 ? "作品A" : "作品B");
    return metaPath;
  });
  writeFileSync(
    paths[1]!,
    readFileSync(paths[1]!, "utf-8").replace(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ),
  );

  migrateMetaIds({ root, metaPaths: paths, dataRoot });
  migrateMetaIds({ root, metaPaths: paths, dataRoot });
  const manifest = readManifestFile(dataRoot);
  assert.equal(manifest.libraryCompleted, true);

  let metaHashCount = 0;
  const third = migrateMetaIds({
    root,
    metaPaths: paths,
    dataRoot,
    onMetaHash: () => {
      metaHashCount += 1;
    },
  });
  assert.equal(third.migrated, 0);
  assert.equal(metaHashCount, 0);
});

test("verifiedIdSignatures 入りの旧 manifest があっても移行に成功する", (t) => {
  const directory = makeTestDirectory("meta-id-legacy-manifest");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeLegacyMeta(metaPath);

  migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });
  migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });

  const migrationsRoot = join(dataRoot, "migrations", "playlist-track-ids");
  const operationRoot = join(migrationsRoot, readdirSync(migrationsRoot)[0]!);
  const manifestPath = join(operationRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  manifest.verifiedIdSignatures = {
    "work/mimimilli.json": {
      size: 999,
      mtimeMs: 1234567890,
      workId: "deadbeef-dead-4ead-8ead-deadbeefdead",
      playlistIds: ["deadbeef-dead-4ead-8ead-deadbeefdeae"],
      trackIds: ["deadbeef-dead-4ead-8ead-deadbeefdeaf"],
    },
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot });
  assert.equal(result.migrated, 0);
  assert.deepEqual(result.externallyModified, []);
  assert.equal(readManifestFile(dataRoot).libraryCompleted, true);
});

test("外部編集で重複IDになった作品が混在しても重複を見逃さず再採番する", (t) => {
  const directory = makeTestDirectory("meta-id-duplicate-reassign");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const paths = ["work-a", "work-b"].map((name, index) => {
    const workDir = join(root, name);
    const metaPath = join(workDir, "mimimilli.json");
    mkdirSync(workDir, { recursive: true });
    writeLegacyMeta(metaPath, index === 0 ? "作品A" : "作品B");
    return metaPath;
  });
  writeFileSync(
    paths[1]!,
    readFileSync(paths[1]!, "utf-8").replace(
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
    ),
  );

  migrateMetaIds({ root, metaPaths: paths, dataRoot });
  migrateMetaIds({ root, metaPaths: paths, dataRoot });
  const manifestBefore = readManifestFile(dataRoot);
  assert.equal(manifestBefore.libraryCompleted, true);

  // work-b だけ外部編集して work-a と同じ workId/playlistId/trackId を持たせる（重複注入）。
  const migratedA = JSON.parse(readFileSync(paths[0]!, "utf-8"));
  const corrupted = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  corrupted.id = migratedA.id;
  corrupted.playlists[0].id = migratedA.playlists[0].id;
  corrupted.playlists[0].tracks[0].id = migratedA.playlists[0].tracks[0].id;
  writeFileSync(paths[1]!, `${JSON.stringify(corrupted, null, 2)}\n`);

  const result = migrateMetaIds({
    root,
    metaPaths: paths,
    dataRoot,
  });
  assert.equal(result.externallyModified.length, 0);
  assert.equal(result.migrated, 1);

  const reassignedA = JSON.parse(readFileSync(paths[0]!, "utf-8"));
  const reassignedB = JSON.parse(readFileSync(paths[1]!, "utf-8"));
  assert.deepEqual(reassignedA, migratedA);
  assert.notEqual(reassignedB.id, reassignedA.id);
  assert.notEqual(reassignedB.playlists[0].id, reassignedA.playlists[0].id);
  assert.notEqual(reassignedB.playlists[0].tracks[0].id, reassignedA.playlists[0].tracks[0].id);

  const manifestAfter = readManifestFile(dataRoot);
  assert.equal(manifestAfter.libraryCompleted, true);
});

test("Windowsではmanifestの相対パスキーをケース非区別で照合する", (t) => {
  const directory = makeTestDirectory("meta-id-win32-path");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const dataRoot = join(directory.path, "data");
  const workDir = join(root, "Work");
  const metaPath = join(workDir, "mimimilli.json");
  mkdirSync(workDir, { recursive: true });
  writeLegacyMeta(metaPath);
  migrateMetaIds({ root, metaPaths: [metaPath], dataRoot, maxWrites: 0, platform: "win32" });

  const migrationsRoot = join(dataRoot, "migrations", "playlist-track-ids");
  const operationRoot = join(migrationsRoot, readdirSync(migrationsRoot)[0]!);
  const manifestPath = join(operationRoot, "manifest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  manifest.operations[0].relativePath = "WORK/MIMIMILLI.JSON";
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const result = migrateMetaIds({ root, metaPaths: [metaPath], dataRoot, platform: "win32" });
  assert.equal(result.migrated, 1);
  const migrated = JSON.parse(readFileSync(metaPath, "utf-8"));
  assert.equal(migrated.playlists[0].id, manifest.operations[0].playlistIds[0]);
});
