import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { emptyDlsiteState, workspacePath } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { readMetaSource } from "../../src/adapters/real/meta.ts";
import { createWorkRepos, getTestWork } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function metaWithSingleTrack(id: string, title: string, dlsite = emptyDlsiteState()) {
  return {
    formatVersion: 1,
    id,
    title,
    playlists: [
      {
        id: crypto.randomUUID(),
        name: "default",
        tracks: [{ id: crypto.randomUUID(), title: "track", file: "track.wav" }],
      },
    ],
    defaultPlaylistId: null,
    dlsite,
  };
}

test("既存作品の空RJコードはフルscanでもmimimilli.jsonを書き換えずcatalogも空のまま", async (t) => {
  const directory = makeTestDirectory("projection-scan-does-not-write-rj");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_既存");
  const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const metaPath = join(workDir, "mimimilli.json");
  writeFileSync(metaPath, JSON.stringify(metaWithSingleTrack(id, "既存")));

  const db = directory.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos, { measureCover: async () => null });
  await scanner.scan(root);
  const before = readFileSync(metaPath);

  await scanner.scan(root, { full: true });

  assert.equal(readFileSync(metaPath).equals(before), true);
  assert.equal((await getTestWork(db, id))?.dlsite.rjCode, null);
});

test("単作品投影はmimimilli.jsonのbytesを変えない", async (t) => {
  const directory = makeTestDirectory("projection-project-does-not-write");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_既存");
  const id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const metaPath = join(workDir, "mimimilli.json");
  writeFileSync(metaPath, JSON.stringify(metaWithSingleTrack(id, "既存")));

  const db = directory.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos, { measureCover: async () => null });
  await scanner.scan(root);
  const before = readFileSync(metaPath);

  const outcome = await scanner.projectMetaFile(metaPath, readMetaSource(metaPath));
  assert.equal(outcome.status, "published");
  assert.equal(readFileSync(metaPath).equals(before), true);
  assert.equal((await getTestWork(db, id))?.dlsite.rjCode, null);
});

test("候補登録は検出コードを1回の正本書込みに含め、直後のフルscanはbytesを変えない", async (t) => {
  const directory = makeTestDirectory("projection-register-once");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_自動検出作品");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();
  const registered = await adapter.registerScanCandidates([
    { path: workspacePath("RJ123456_自動検出作品") },
  ]);
  assert.equal(registered.registered.length, 1);

  const metaPath = join(workDir, "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { dlsite: { rjCode: string | null } };
  assert.equal(meta.dlsite.rjCode, "RJ123456");
  const before = readFileSync(metaPath);

  await adapter.scan({ full: true });
  assert.equal(readFileSync(metaPath).equals(before), true);
});

test("単作品投影は公開前にsourceが変わったらunpublishedで旧catalogを維持する", async (t) => {
  const directory = makeTestDirectory("projection-unpublished-on-change");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "work");
  const id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const metaPath = join(workDir, "mimimilli.json");
  writeFileSync(
    metaPath,
    JSON.stringify({
      ...(metaWithSingleTrack(id, "before") as Record<string, unknown>),
      coverImage: "cover.jpg",
    }),
  );
  writeFileSync(join(workDir, "cover.jpg"), "cover");

  const db = directory.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const initial = new Scanner(db, repos, { measureCover: async () => null });
  await initial.scan(root);
  const originalRevision = db.sqlite
    .query("SELECT source_revision AS revision FROM works WHERE id = ?")
    .get(id) as { revision: string };

  let changed = false;
  const scanner = new Scanner(db, repos, {
    measureCover: async () => {
      if (!changed) {
        changed = true;
        const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as Record<string, unknown>;
        meta.title = "after";
        writeFileSync(metaPath, JSON.stringify(meta));
      }
      return null;
    },
  });
  const snapshot = readMetaSource(metaPath);
  const outcome = await scanner.projectMetaFile(metaPath, snapshot);

  assert.equal(outcome.status, "unpublished");
  if (outcome.status !== "unpublished") return;
  assert.equal(outcome.reason, "source_changed");
  assert.equal(outcome.snapshot.sourceRevision, snapshot.sourceRevision);
  assert.notEqual(outcome.currentSourceRevision, snapshot.sourceRevision);
  assert.equal((await getTestWork(db, id))?.title, "before");
  const after = db.sqlite
    .query("SELECT source_revision AS revision, title FROM works WHERE id = ?")
    .get(id) as { revision: string; title: string };
  assert.equal(after.title, "before");
  assert.equal(after.revision, originalRevision.revision);
  assert.notEqual(after.revision, outcome.currentSourceRevision);
  assert.equal(JSON.parse(readFileSync(metaPath, "utf-8")).title, "after");
});
