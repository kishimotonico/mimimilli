import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { spyOn } from "bun:test";
import { emptyDlsiteState, workspacePath } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { DlsiteJobManager } from "../../src/dlsiteJobManager.ts";
import { CatalogWorkRepository } from "../../src/adapters/real/catalogWorkRepository.ts";
import { DlsiteScheduler } from "../../src/adapters/real/dlsiteScheduler.ts";
import { ScanUpsertBatch } from "../../src/adapters/real/scanUpsertBatch.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

const OWNER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PLAYLIST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TRACK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function writeWork(workDir: string, id: string, title: string) {
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    `${JSON.stringify(
      {
        formatVersion: 1,
        id,
        title,
        playlists: [
          {
            id: PLAYLIST_ID,
            name: "default",
            tracks: [{ id: TRACK_ID, title: "本編", file: "track.wav" }],
          },
        ],
        defaultPlaylistId: PLAYLIST_ID,
        dlsite: emptyDlsiteState(),
      },
      null,
      2,
    )}\n`,
  );
}

async function setupLibrary(t: TestContext, name: string) {
  const directory = makeTestDirectory(name);
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "work");
  writeWork(workDir, OWNER_ID, "before");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan({ full: true });
  return { app, adapter, root, workDir };
}

function wrapUpsert(onCall: (work: { id: string; title: string }, metaPath: string) => void) {
  const original = CatalogWorkRepository.prototype.upsertWorkCatalog;
  const spy = spyOn(CatalogWorkRepository.prototype, "upsertWorkCatalog").mockImplementation(
    function (this: CatalogWorkRepository, work, options) {
      onCall(work, options.metaPath);
      return original.call(this, work, options);
    },
  );
  return spy;
}

function spyEnqueue(t: TestContext) {
  const calls: Array<{ mode: string; workIds: string[] | undefined }> = [];
  const spy = spyOn(DlsiteJobManager.prototype, "enqueue").mockImplementation(
    function (mode, workIds) {
      calls.push({ mode, workIds });
    },
  );
  t.after(() => spy.mockRestore());
  return calls;
}

function wrapBatchAdd(onCall: (metaPath: string) => void) {
  const original = ScanUpsertBatch.prototype.add;
  const spy = spyOn(ScanUpsertBatch.prototype, "add").mockImplementation(
    function (this: ScanUpsertBatch, work, revisions, cover, metaPath) {
      onCall(metaPath);
      return original.call(this, work, revisions, cover, metaPath);
    },
  );
  return spy;
}

test("PATCH後にcatalog書込みが失敗しても正本は確定しpending/errorになる", async (t) => {
  const { app, adapter, workDir } = await setupLibrary(t, "projection-catalog-fail");
  const source = await adapter.getWorkEditSnapshot(OWNER_ID);
  assert.ok(source);

  let failNext = false;
  const spy = wrapUpsert(() => {
    if (failNext) throw new Error("catalog write failed");
  });
  t.after(() => spy.mockRestore());
  failNext = true;

  const res = await app.request(`/api/works/${OWNER_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "after", sourceRevision: source.sourceRevision }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.snapshot.title, "after");
  assert.deepEqual(body.projection, { status: "pending", reason: "error" });
  assert.equal(JSON.parse(readFileSync(join(workDir, "mimimilli.json"), "utf-8")).title, "after");
  assert.equal((await adapter.getWork(OWNER_ID))?.title, "before");

  failNext = false;
  const replay = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work" }),
  });
  assert.equal(replay.status, 200);
  const replayed = await replay.json();
  assert.deepEqual(replayed.projection, { status: "published" });
  assert.equal((await adapter.getWork(OWNER_ID))?.title, "after");
});

test("PATCH中に正本が変わるとpending/source_changedになり再投影で現行正本が載る", async (t) => {
  const { app, adapter, workDir } = await setupLibrary(t, "projection-unpublished-patch");
  const source = await adapter.getWorkEditSnapshot(OWNER_ID);
  assert.ok(source);

  let rewrite = false;
  const spy = wrapBatchAdd((metaPath) => {
    if (!rewrite) return;
    rewrite = false;
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { title: string };
    meta.title = "disk-after";
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  });
  t.after(() => spy.mockRestore());
  rewrite = true;

  const res = await app.request(`/api/works/${OWNER_ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: "patch-title", sourceRevision: source.sourceRevision }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.snapshot.title, "patch-title");
  assert.deepEqual(body.projection, { status: "pending", reason: "source_changed" });
  assert.equal((await adapter.getWork(OWNER_ID))?.title, "before");
  assert.equal(
    JSON.parse(readFileSync(join(workDir, "mimimilli.json"), "utf-8")).title,
    "disk-after",
  );

  const replay = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work" }),
  });
  assert.equal(replay.status, 200);
  const replayed = await replay.json();
  assert.deepEqual(replayed.projection, { status: "published" });
  assert.equal(replayed.snapshot.title, "disk-after");
  assert.equal((await adapter.getWork(OWNER_ID))?.title, "disk-after");
});

test("新規登録がunpublishedでも201になり同じpathの再投影でcatalogに出る", async (t) => {
  spyEnqueue(t);
  const directory = makeTestDirectory("projection-register-unpublished");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "new-work");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  let rewrite = false;
  const spy = wrapBatchAdd((metaPath) => {
    if (!rewrite) return;
    rewrite = false;
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { title: string };
    meta.title = "changed-during-project";
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  });
  t.after(() => spy.mockRestore());
  rewrite = true;

  const created = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspacePath("new-work"), title: "登録タイトル" }),
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.snapshot.title, "登録タイトル");
  assert.deepEqual(body.projection, { status: "pending", reason: "source_changed" });
  assert.ok(readFileSync(join(workDir, "mimimilli.json"), "utf-8"));
  assert.equal(await adapter.getWork(body.snapshot.id), null);

  const replay = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "new-work" }),
  });
  assert.equal(replay.status, 200);
  const replayed = await replay.json();
  assert.deepEqual(replayed.projection, { status: "published" });
  assert.equal(replayed.snapshot.title, "changed-during-project");
  assert.equal((await adapter.getWork(body.snapshot.id))?.title, "changed-during-project");
});

test("apply-missingは1件の投影例外をpendingに数え後続はappliedになる", async (t) => {
  const directory = makeTestDirectory("projection-apply-missing-pending");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const firstId = "11111111-1111-4111-8111-111111111111";
  const secondId = "22222222-2222-4222-8222-222222222222";
  writeWork(join(root, "first"), firstId, "一件目");
  writeWork(join(root, "second"), secondId, "二件目");
  const firstMeta = JSON.parse(readFileSync(join(root, "first", "mimimilli.json"), "utf-8")) as {
    dlsite: { rjCode: string | null };
  };
  firstMeta.dlsite.rjCode = "RJ900001";
  writeFileSync(join(root, "first", "mimimilli.json"), `${JSON.stringify(firstMeta, null, 2)}\n`);
  const secondMeta = JSON.parse(readFileSync(join(root, "second", "mimimilli.json"), "utf-8")) as {
    dlsite: { rjCode: string | null };
  };
  secondMeta.dlsite.rjCode = "RJ900002";
  writeFileSync(join(root, "second", "mimimilli.json"), `${JSON.stringify(secondMeta, null, 2)}\n`);

  const { DEFAULT_DLSITE_REQUEST_CONFIG } = await import("../../src/adapters/real/dlsiteConfig.ts");
  const { htmlResponse, mockDlsiteTransport, sampleWorkHtml } =
    await import("../helpers/dlsiteTransport.ts");
  const { createRealAdapter } = await import("../../src/adapters/real/index.ts");
  const adapter = directory.own(
    createRealAdapter({
      database: { kind: "memory" },
      dlsiteCache: { path: join(directory.path, "cache.sqlite") },
      dlsiteRequestConfig: {
        ...DEFAULT_DLSITE_REQUEST_CONFIG,
        requestIntervalMs: 0,
        retryCount: 0,
      },
      dlsiteSchedulerDependencies: mockDlsiteTransport({
        html: (code) => htmlResponse(sampleWorkHtml(code, { title: "取得タイトル", cover: false })),
      }),
    }),
  );
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan({ full: true });
  await adapter.runDlsiteBulk("existing", [firstId, secondId]);

  const spy = wrapUpsert((work) => {
    if (work.id === firstId) throw new Error("catalog write failed");
  });
  t.after(() => spy.mockRestore());

  const result = await adapter.dlsiteApplyMissing([firstId, secondId]);
  assert.deepEqual(result, { applied: 1, pending: 1, skipped: 0, failed: 0 });
  assert.equal(
    JSON.parse(readFileSync(join(root, "first", "mimimilli.json"), "utf-8")).dlsite.status,
    "applied",
  );
  assert.ok((await adapter.getWork(secondId))?.tags.length);
});

test("POST /works/projection の path は root 外・不存在なら invalid_request", async (t) => {
  const { app } = await setupLibrary(t, "projection-path-validation");

  const outside = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "../outside" }),
  });
  assert.equal(outside.status, 400);
  assert.equal((await outside.json()).error.code, "invalid_request");

  const missing = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "does-not-exist" }),
  });
  assert.equal(missing.status, 400);
  assert.equal((await missing.json()).error.code, "invalid_request");
});

test("投影先のWork IDが別pathのcatalogにあればidentity_conflictで既存行を上書きしない", async (t) => {
  const { app, adapter, root } = await setupLibrary(t, "projection-identity-conflict");
  const copyDir = join(root, "work-copy");
  writeWork(copyDir, OWNER_ID, "複製側");

  const ownerBefore = await adapter.getWork(OWNER_ID);
  assert.equal(ownerBefore?.physicalPath, join(root, "work"));
  assert.equal(ownerBefore?.title, "before");

  const res = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work-copy" }),
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.snapshot.title, "複製側");
  assert.deepEqual(body.projection, { status: "pending", reason: "identity_conflict" });

  const ownerAfter = await adapter.getWork(OWNER_ID);
  assert.equal(ownerAfter?.physicalPath, join(root, "work"));
  assert.equal(ownerAfter?.title, "before");

  const diagnostics = await adapter.listScanDiagnostics();
  const conflict = diagnostics.find((item) => item.kind === "identity_conflict");
  assert.ok(conflict);
  assert.equal(conflict.workId, OWNER_ID);
  assert.deepEqual(conflict.paths, ["work", "work-copy"]);
});

test("登録がpendingで終わった作品はprojectionでpublishedになったときenqueueが1回呼ばれる", async (t) => {
  const enqueued = spyEnqueue(t);
  const directory = makeTestDirectory("projection-register-enqueue");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "new-work");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  let rewrite = false;
  const spy = wrapBatchAdd((metaPath) => {
    if (!rewrite) return;
    rewrite = false;
    const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as { title: string };
    meta.title = "changed-during-project";
    writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  });
  t.after(() => spy.mockRestore());
  rewrite = true;

  const created = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: workspacePath("new-work"), title: "登録タイトル" }),
  });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.deepEqual(body.projection, { status: "pending", reason: "source_changed" });
  assert.deepEqual(enqueued, []);

  const replay = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "new-work" }),
  });
  assert.equal(replay.status, 200);
  const replayed = await replay.json();
  assert.deepEqual(replayed.projection, { status: "published" });
  assert.equal(replayed.catalogInserted, undefined);
  assert.deepEqual(enqueued, [{ mode: "new", workIds: [body.snapshot.id] }]);

  const second = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "new-work" }),
  });
  assert.equal(second.status, 200);
  assert.deepEqual((await second.json()).projection, { status: "published" });
  assert.deepEqual(enqueued, [{ mode: "new", workIds: [body.snapshot.id] }]);
});

test("既存作品の再投影ではonWorkRegisteredを呼ばない", async (t) => {
  const enqueued = spyEnqueue(t);
  const { app } = await setupLibrary(t, "projection-existing-no-enqueue");
  const res = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work" }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).projection, { status: "published" });
  assert.deepEqual(enqueued, []);
});

test("projectionの再試行はDLsiteのHTTP取得を呼ばない", async (t) => {
  const { app, adapter, workDir } = await setupLibrary(t, "projection-no-dlsite-http");
  const metaPath = join(workDir, "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8")) as {
    dlsite: { rjCode: string | null };
  };
  meta.dlsite.rjCode = "RJ900001";
  writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`);
  const snapshot = await adapter.getWorkEditSnapshot(OWNER_ID);
  assert.ok(snapshot);
  await adapter.patchWorkSource(OWNER_ID, {
    sourceRevision: snapshot.sourceRevision,
    title: "コード付き",
  });

  const schedulerFetch = spyOn(DlsiteScheduler.prototype, "fetch");
  const globalFetch = spyOn(globalThis, "fetch");
  t.after(() => {
    schedulerFetch.mockRestore();
    globalFetch.mockRestore();
  });

  const res = await app.request("/api/works/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: "work" }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).projection, { status: "published" });
  assert.equal(schedulerFetch.mock.calls.length, 0);
  assert.equal(globalFetch.mock.calls.length, 0);
});
