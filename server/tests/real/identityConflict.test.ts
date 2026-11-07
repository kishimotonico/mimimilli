import assert from "node:assert/strict";
import * as fs from "node:fs";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { workspacePath } from "@mimimilli/shared";
import { spyOn } from "bun:test";
import { test } from "node:test";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createWorkRepos } from "../helpers/workTestUtils.ts";
import { createApp } from "../helpers/testApp.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";

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
  await configureRoot(adapter, root);

  const result = await adapter.scan({ full: true });

  assert.equal(result.registered, 0);
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-a", "work-z"] },
  ]);
  assert.equal(readFileSync(first, "utf-8"), before[0]);
  assert.equal(readFileSync(second, "utf-8"), before[1]);
  assert.equal(await adapter.getWork(WORK_ID), null);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request("/api/scan/diagnostics");
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).identityConflicts,
    (await adapter.listScanDiagnostics()).identityConflicts,
  );
});

test("既存投影は競合pathの順序にかかわらず保持し、解消後に一意なmimimilli.jsonを投影する", async (t) => {
  const directory = makeTestDirectory("identity-conflict-existing");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const owner = makeWork(root, "work-z-owner", "既存投影");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  const duplicate = makeWork(root, "work-a-copy", "新しい競合path");
  const conflict = await adapter.scan({ full: true });
  assert.equal(conflict.registered, 0);
  assert.equal((await adapter.getWork(WORK_ID))?.title, "既存投影");
  assert.equal((await adapter.getWork(WORK_ID))?.physicalPath, join(root, "work-z-owner"));
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts[0]?.paths, [
    "work-a-copy",
    "work-z-owner",
  ]);

  writeMeta(duplicate, "別作品", "22222222-2222-4222-8222-222222222222");
  await adapter.scan({ full: true });
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
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
  await configureRoot(adapter, root);
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
  const body = await response.json();
  assert.notEqual(body.snapshot.id, WORK_ID);
  assert.equal(body.snapshot.title, "複製側");
  assert.equal(body.projection.status, "published");
  const work = await adapter.getWork(body.snapshot.id);
  assert.ok(work);
  assert.equal(work.bookmarked, false);
  assert.equal(work.resume, null);

  const after = JSON.parse(readFileSync(copy, "utf-8"));
  assert.notEqual(after.id, before.id);
  assert.deepEqual({ ...after, id: before.id }, before);
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
  assert.equal(work.physicalPath, join(root, "work-copy"));
});

test("壊れたコピーのcandidateIdで既存作品の投影を乗っ取らない", async (t) => {
  const directory = makeTestDirectory("broken-copy-identity-conflict");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-owner", "元作品");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  const ownerBefore = await adapter.getWork(WORK_ID);
  assert.ok(ownerBefore);
  assert.equal(ownerBefore!.physicalPath, join(root, "work-owner"));
  assert.equal(ownerBefore!.status, "ok");

  const copyDir = join(root, "work-copy");
  mkdirSync(copyDir, { recursive: true });
  writeWav(join(copyDir, "track.wav"), 1);
  const copyMeta = join(copyDir, "mimimilli.json");
  writeFileSync(
    copyMeta,
    `{
  "formatVersion": 1,
  "id": "${WORK_ID}",
  "title": `,
  );

  await adapter.scan({ full: true });
  const ownerAfter = await adapter.getWork(WORK_ID);

  assert.equal(ownerAfter?.physicalPath, ownerBefore!.physicalPath);
  assert.equal(ownerAfter?.status, "ok");
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-copy", "work-owner"] },
  ]);
  assert.equal((await adapter.listScanDiagnostics()).invalidMetaFiles.length, 1);
  assert.equal(
    (await adapter.listScanDiagnostics()).invalidMetaFiles[0]?.path,
    "work-copy/mimimilli.json",
  );

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request("/api/scan/diagnostics");
  assert.equal(response.status, 200);
  assert.deepEqual(
    (await response.json()).identityConflicts,
    (await adapter.listScanDiagnostics()).identityConflicts,
  );
});

test("root変更後、旧rootの作品IDと衝突する壊れたメタがあってもスキャン全体は失敗せず他作品は登録される", async (t) => {
  const directory = makeTestDirectory("stale-root-identity-conflict");
  t.after(directory.cleanup);
  const rootA = join(directory.path, "library-a");
  const rootB = join(directory.path, "library-b");
  const OTHER_WORK_ID = "22222222-2222-4222-8222-222222222222";
  makeWork(rootA, "work-owner", "旧root作品");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, rootA);
  await adapter.scan({ full: true });

  const ownerBefore = await adapter.getWork(WORK_ID);
  assert.ok(ownerBefore);
  assert.equal(ownerBefore!.physicalPath, join(rootA, "work-owner"));
  assert.equal(ownerBefore!.status, "ok");

  makeWork(rootB, "work-other", "新root作品", OTHER_WORK_ID);
  await configureRoot(adapter, rootB);
  await adapter.scan({ full: true });

  const ownerAfterRootChange = await adapter.getWork(WORK_ID);
  assert.equal(ownerAfterRootChange?.status, "missing");
  assert.equal(ownerAfterRootChange?.physicalPath, join(rootA, "work-owner"));

  const brokenDir = join(rootB, "work-broken");
  mkdirSync(brokenDir, { recursive: true });
  writeWav(join(brokenDir, "track.wav"), 1);
  writeFileSync(
    join(brokenDir, "mimimilli.json"),
    `{
  "formatVersion": 1,
  "id": "${WORK_ID}",
  "title": `,
  );

  await adapter.scan({ full: true });

  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
  assert.equal((await adapter.listScanDiagnostics()).invalidMetaFiles.length, 1);
  assert.equal(
    (await adapter.listScanDiagnostics()).invalidMetaFiles[0]?.path,
    "work-broken/mimimilli.json",
  );
  assert.equal((await adapter.getWork(OTHER_WORK_ID))?.title, "新root作品");
  assert.equal((await adapter.getWork(WORK_ID))?.status, "missing");

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request("/api/scan/diagnostics");
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).identityConflicts, []);
});

test("登録解除すると該当pathがidentity_conflict診断から消え、残り1pathなら診断ごと消える", async (t) => {
  const directory = makeTestDirectory("identity-conflict-unregister");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-z-owner", "既存投影");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  makeWork(root, "work-a-copy", "重複コピー");
  await adapter.scan({ full: true });
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-a-copy", "work-z-owner"] },
  ]);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request(`/api/works/${WORK_ID}`, { method: "DELETE" });
  assert.equal(response.status, 204);

  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
  const diagnosticsResponse = await app.request("/api/scan/diagnostics");
  assert.deepEqual((await diagnosticsResponse.json()).identityConflicts, []);
});

test("登録解除しても残りpathが2以上なら診断は残り、該当pathだけが消える", async (t) => {
  const directory = makeTestDirectory("identity-conflict-unregister-keep");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-owner", "既存投影");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  makeWork(root, "work-copy-1", "重複コピー1");
  makeWork(root, "work-copy-2", "重複コピー2");
  await adapter.scan({ full: true });
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    {
      kind: "identity_conflict",
      workId: WORK_ID,
      paths: ["work-copy-1", "work-copy-2", "work-owner"],
    },
  ]);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request(`/api/works/${WORK_ID}`, { method: "DELETE" });
  assert.equal(response.status, 204);

  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-copy-1", "work-copy-2"] },
  ]);
});

test("root外を指すmissing作品を単体登録解除しても成功し、他の診断は壊れない", async (t) => {
  const directory = makeTestDirectory("identity-conflict-unregister-stale-root");
  t.after(directory.cleanup);
  const rootA = join(directory.path, "library-a");
  const rootB = join(directory.path, "library-b");
  const OTHER_WORK_ID = "22222222-2222-4222-8222-222222222222";
  makeWork(rootA, "work-owner", "旧root作品");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, rootA);
  await adapter.scan({ full: true });

  makeWork(rootB, "work-other-owner", "新root作品", OTHER_WORK_ID);
  await configureRoot(adapter, rootB);
  await adapter.scan({ full: true });
  assert.equal((await adapter.getWork(WORK_ID))?.status, "missing");

  makeWork(rootB, "work-other-copy", "新root複製", OTHER_WORK_ID);
  await adapter.scan({ full: true });
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    {
      kind: "identity_conflict",
      workId: OTHER_WORK_ID,
      paths: ["work-other-copy", "work-other-owner"],
    },
  ]);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request(`/api/works/${WORK_ID}`, { method: "DELETE" });
  assert.equal(response.status, 204);
  assert.equal(await adapter.getWork(WORK_ID), null);
  assert.deepEqual(
    (await adapter.listScanDiagnostics()).identityConflicts,
    (await adapter.listScanDiagnostics()).identityConflicts,
  );
});

test("root外を指すmissing作品はunregister-missing一括でも成功扱いになる", async (t) => {
  const directory = makeTestDirectory("identity-conflict-unregister-missing-stale-root");
  t.after(directory.cleanup);
  const rootA = join(directory.path, "library-a");
  const rootB = join(directory.path, "library-b");
  makeWork(rootA, "work-owner", "旧root作品");
  mkdirSync(rootB, { recursive: true });
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, rootA);
  await adapter.scan({ full: true });

  await configureRoot(adapter, rootB);
  await adapter.scan({ full: true });
  assert.equal((await adapter.getWork(WORK_ID))?.status, "missing");

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request("/api/works/unregister-missing", { method: "POST" });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deletedCount: 1, failedCount: 0 });
  assert.equal(await adapter.getWork(WORK_ID), null);
});

test("reassign対象のmimimilli.jsonが削除・破損していると構造化エラーを返す", async (t) => {
  const directory = makeTestDirectory("identity-conflict-reassign-broken-meta");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-owner", "元作品");
  const copy = makeWork(root, "work-copy", "複製側");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());

  unlinkSync(copy);
  const missing = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work-copy" }),
  });
  assert.equal(missing.status, 409);
  const missingBody = await missing.json();
  assert.equal(missingBody.error.code, "conflict");

  writeFileSync(copy, "{ 不正なJSON");
  const broken = await app.request("/api/works/identity-conflicts/reassign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work-copy" }),
  });
  assert.equal(broken.status, 502);
  const brokenBody = await broken.json();
  assert.equal(brokenBody.error.code, "parse_error");
});

test("同一ディレクトリの壊れたメタは従来どおり作品をerrorにする", async (t) => {
  const directory = makeTestDirectory("broken-meta-same-dir");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const metaPath = makeWork(root, "work-a", "作品A");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });

  writeFileSync(
    metaPath,
    `${JSON.stringify({
      formatVersion: 1,
      id: WORK_ID,
      title: 123,
      playlists: [],
    })}
`,
  );

  const result = await adapter.scan({ full: true });
  const work = await adapter.getWork(WORK_ID);

  assert.equal(result.errors, 1);
  assert.equal(work?.status, "error");
  assert.equal(work?.physicalPath, join(root, "work-a"));
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
});

test("scanは1つのメタファイルを1回しか読まない", async (t) => {
  const directory = makeTestDirectory("identity-conflict-single-read");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const valid = makeWork(root, "work-a", "A", "22222222-2222-4222-8222-222222222222");
  const duplicateA = makeWork(root, "work-b", "B");
  const duplicateB = makeWork(root, "work-c", "C");
  const broken = join(root, "work-d", "mimimilli.json");
  mkdirSync(join(root, "work-d"), { recursive: true });
  writeFileSync(broken, '{ "id": "33333333-3333-4333-8333-333333333333", ');
  const db = directory.own(openDb({ kind: "memory" }));
  const scanner = new Scanner(db, createWorkRepos(db));

  const spy = spyOn(fs, "readFileSync");
  let calls: unknown[][];
  try {
    await scanner.scan(root, { full: true });
  } finally {
    calls = [...spy.mock.calls];
    spy.mockRestore();
  }

  const readCount = (path: string): number => calls.filter(([read]) => read === path).length;
  assert.deepEqual([duplicateA, duplicateB, broken].map(readCount), [1, 1, 1]);
  // 登録した作品だけ、公開前のsourceRevision再検証で読み直す
  assert.equal(readCount(valid), 2);
});

test("有効な同IDが2つある状態で壊れた3つ目のコピーはinvalidMetaFilesに載る", async (t) => {
  const directory = makeTestDirectory("identity-conflict-broken-third");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  makeWork(root, "work-a", "A");
  makeWork(root, "work-b", "B");
  const brokenDir = join(root, "work-c");
  mkdirSync(brokenDir, { recursive: true });
  writeFileSync(join(brokenDir, "mimimilli.json"), `{ "id": "${WORK_ID}", `);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);

  await adapter.scan({ full: true });

  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, [
    { kind: "identity_conflict", workId: WORK_ID, paths: ["work-a", "work-b"] },
  ]);
  assert.deepEqual(
    (await adapter.listScanDiagnostics()).invalidMetaFiles.map((file) => file.path),
    ["work-c/mimimilli.json"],
  );
});

test("読めないmimimilli.jsonは現在の診断として返り、再スキャンで直ったものは消える", async (t) => {
  const directory = makeTestDirectory("invalid-meta-diagnostics");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const brokenPath = makeWork(root, "broken", "壊れる作品");
  writeFileSync(brokenPath, "{");
  makeWork(root, "healthy", "健全な作品", "22222222-2222-4222-8222-222222222222");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());

  await adapter.scan({ full: true });
  const first = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(
    first.invalidMetaFiles.map((file: { path: string }) => file.path),
    ["broken/mimimilli.json"],
  );
  assert.deepEqual(first.identityConflicts, []);

  writeMeta(brokenPath, "直った作品");
  await adapter.scan({ full: true });
  const second = await (await app.request("/api/scan/diagnostics")).json();
  assert.deepEqual(second.invalidMetaFiles, []);
});

test("読めない作品情報を持つ作品を登録解除すると、診断からも消える", async (t) => {
  const directory = makeTestDirectory("invalid-meta-unregister");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const metaPath = makeWork(root, "work", "作品");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });
  writeFileSync(metaPath, "{");
  await adapter.scan({ full: true });
  assert.equal((await adapter.getWork(WORK_ID))?.status, "error");
  assert.equal((await adapter.listScanDiagnostics()).invalidMetaFiles.length, 1);

  const app = directory.ownFn(createApp(adapter), (a) => a.shutdown());
  const response = await app.request(`/api/works/${WORK_ID}`, { method: "DELETE" });
  assert.equal(response.status, 204);

  assert.deepEqual((await adapter.listScanDiagnostics()).invalidMetaFiles, []);
});

test("読めなかったmimimilli.jsonを直してFilesから投影すると、診断から消える", async (t) => {
  const directory = makeTestDirectory("invalid-meta-project");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  const metaPath = makeWork(root, "broken", "直す作品");
  writeFileSync(metaPath, "{");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan({ full: true });
  assert.equal((await adapter.listScanDiagnostics()).invalidMetaFiles.length, 1);

  writeMeta(metaPath, "直した作品");
  const projected = await adapter.projectWorkSource(workspacePath("broken"));

  assert.equal(projected?.projection.status, "published");
  assert.deepEqual((await adapter.listScanDiagnostics()).invalidMetaFiles, []);
});

test("root変更の開始で旧rootの診断が消え、再スキャン前に別rootの相対パスとして残らない", async (t) => {
  const directory = makeTestDirectory("diagnostics-root-change");
  t.after(directory.cleanup);
  const rootA = join(directory.path, "library-a");
  const rootB = join(directory.path, "library-b");
  mkdirSync(rootB, { recursive: true });
  writeFileSync(makeWork(rootA, "broken", "壊れる"), "{");
  makeWork(rootA, "copy-a", "A", "33333333-3333-4333-8333-333333333333");
  makeWork(rootA, "copy-b", "B", "33333333-3333-4333-8333-333333333333");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, rootA);
  await adapter.scan({ full: true });
  const before = await adapter.listScanDiagnostics();
  assert.equal(before.invalidMetaFiles.length, 1);
  assert.equal(before.identityConflicts.length, 1);

  await adapter.beginRootReconfiguration(await adapter.resolveRootFolder(rootB));

  assert.deepEqual(await adapter.listScanDiagnostics(), {
    identityConflicts: [],
    invalidMetaFiles: [],
  });
});
