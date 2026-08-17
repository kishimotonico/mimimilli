import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../../src/app.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

const WORK_ID = "11111111-1111-4111-8111-111111111111";

function writeMeta(path: string, title: string, workId = WORK_ID): void {
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        formatVersion: 1,
        id: workId,
        title,
        playlists: [
          {
            id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            name: "default",
            tracks: [
              {
                id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                title: "本編",
                file: "track.wav",
              },
            ],
          },
        ],
        defaultPlaylistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      null,
      2,
    )}\n`,
  );
}

function makeWork(root: string, name: string, title: string, workId = WORK_ID): string {
  const workDir = join(root, name);
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const metaPath = join(workDir, "mimimilli.json");
  writeMeta(metaPath, title, workId);
  return metaPath;
}

test("重複Work IDはmimimilli.jsonを変更せず、catalog公開せずに全pathを診断する", async (t) => {
  const directory = makeTestDirectory("identity-conflict-new");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const first = makeWork(root, "work-a", "A");
  const second = makeWork(root, "work-z", "Z");
  const duplicateLocalIdentity = JSON.parse(readFileSync(second, "utf-8"));
  duplicateLocalIdentity.playlists.push(structuredClone(duplicateLocalIdentity.playlists[0]));
  writeFileSync(second, `${JSON.stringify(duplicateLocalIdentity, null, 2)}\n`);
  const before = [readFileSync(first, "utf-8"), readFileSync(second, "utf-8")];
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });

  const result = await adapter.scan({ full: true });

  assert.equal(result.registered, 0);
  assert.deepEqual(result.identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-a", "work-z"] },
  ]);
  assert.equal(readFileSync(first, "utf-8"), before[0]);
  assert.equal(readFileSync(second, "utf-8"), before[1]);
  assert.equal(await adapter.getWork(WORK_ID), null);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request("/api/scan/diagnostics");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).diagnostics, result.identityConflicts);
});

test("既存投影は競合pathの順序にかかわらず保持し、解消後に一意なmimimilli.jsonを投影する", async (t) => {
  const directory = makeTestDirectory("identity-conflict-existing");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const owner = makeWork(root, "work-z-owner", "既存投影");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan({ full: true });

  const duplicate = makeWork(root, "work-a-copy", "新しい競合path");
  const conflict = await adapter.scan({ full: true });
  assert.equal(conflict.registered, 0);
  assert.equal((await adapter.getWork(WORK_ID))?.title, "既存投影");
  assert.equal((await adapter.getWork(WORK_ID))?.physicalPath, join(root, "work-z-owner"));
  assert.deepEqual(conflict.identityConflicts[0]?.paths, ["work-a-copy", "work-z-owner"]);

  writeMeta(duplicate, "別作品", "22222222-2222-4222-8222-222222222222");
  const resolved = await adapter.scan({ full: true });
  assert.deepEqual(resolved.identityConflicts, []);
  assert.equal((await adapter.getWork("22222222-2222-4222-8222-222222222222"))?.title, "別作品");
  assert.equal(readFileSync(owner, "utf-8").includes(WORK_ID), true);
});

test("identity_conflictの指定pathだけを別作品として取り込み、Work ID以外を維持する", async (t) => {
  const directory = makeTestDirectory("identity-conflict-reassign");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-owner", "元作品");
  const copy = makeWork(root, "work-copy", "複製側");
  const before = JSON.parse(readFileSync(copy, "utf-8"));
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan({ full: true });

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const rejected = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "not-a-diagnostic" }),
  });
  assert.equal(rejected.status, 404);

  const response = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work-copy" }),
  });
  assert.equal(response.status, 201);
  const work = await response.json();
  assert.notEqual(work.id, WORK_ID);
  assert.equal(work.title, "複製側");
  assert.equal(work.bookmarked, false);
  assert.equal(work.resume, null);

  const after = JSON.parse(readFileSync(copy, "utf-8"));
  assert.notEqual(after.id, before.id);
  assert.deepEqual({ ...after, id: before.id }, before);
  assert.deepEqual(await adapter.listScanDiagnostics(), []);
  assert.equal((await adapter.getWork(work.id))?.physicalPath, join(root, "work-copy"));
});
