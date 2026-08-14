import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { ScanJobSnapshot, WorksPage } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { createApp } from "../../src/app.ts";
import { scanAndRegisterCandidates } from "../helpers/scanLibrary.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";
import { DlsiteCache, resolveDlsiteCacheConfig } from "../../src/adapters/real/dlsiteCache.ts";

async function waitForTerminal(
  app: ReturnType<typeof createApp>,
  id: string,
): Promise<ScanJobSnapshot> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const response = await app.request(`/api/scan/${id}`);
    const snapshot = (await response.json()) as ScanJobSnapshot;
    if (["completed", "failed", "cancelled"].includes(snapshot.status)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("scan job did not finish");
}

test(
  "file scan Workerの同期停止中もworks/Range mediaへ応答し、cancel後に再scanできる",
  { timeout: 15_000 },
  async (t) => {
    const library = makeSampleLibrary();
    t.after(library.cleanup);
    const database = {
      kind: "files" as const,
      catalogPath: join(library.baseDir, "data", "db", "catalog.sqlite"),
      userPath: join(library.baseDir, "data", "db", "user.sqlite"),
    };
    const thumbnailCacheDir = join(library.baseDir, "data", "thumbnails");

    const seed = createTestRealAdapter({
      database,
      dataRoot: join(library.baseDir, "data"),
      thumbnailCacheDir,
    });
    await seed.updateSettings({ rootFolder: library.root });
    await scanAndRegisterCandidates(seed);
    const settingsBeforeCancel = await seed.getSettings();
    seed.close();

    const gateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
    const gate = new Int32Array(gateBuffer);
    let ready!: () => void;
    const workerReady = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const adapter = createTestRealAdapter({
      database,
      dataRoot: join(library.baseDir, "data"),
      thumbnailCacheDir,
      scanWorkerTestGate: gateBuffer,
      scanWorkerTestGateStage: "before-finalize",
      onScanWorkerTestGateReady: ready,
    });
    t.after(() => adapter.close());
    const app = createApp(adapter);

    const worksBefore = (await (await app.request("/api/works")).json()) as WorksPage;
    const generated = worksBefore.items.find((work) => work.title.includes("RJ900001"));
    assert.ok(generated);
    // 次のscanがfinalizeへ進めば、この未走査作品はmissingになり、孤児cacheは削除される。
    rmSync(join(library.root, "dlsite", "RJ900002_既存メタ"), {
      recursive: true,
      force: true,
    });
    mkdirSync(thumbnailCacheDir, { recursive: true });
    const orphanThumbnail = join(thumbnailCacheDir, "orphan.webp");
    writeFileSync(orphanThumbnail, "orphan");
    const startedResponse = await app.request("/api/scan", { method: "POST" });
    assert.equal(startedResponse.status, 202);
    const started = (await startedResponse.json()) as { job: ScanJobSnapshot };
    await workerReady;

    const withDeadline = async (
      request: Response | Promise<Response>,
      message = "operation timed out while Worker was blocked",
    ): Promise<Response> =>
      Promise.race([
        Promise.resolve(request),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 5_000)),
      ]);
    assert.equal((await withDeadline(app.request("/api/works"))).status, 200);
    const media = await withDeadline(
      app.request(`/api/media/audio/${generated.id}/mp3/01_intro.wav`, {
        headers: { Range: "bytes=44-143" },
      }),
    );
    assert.equal(media.status, 206);
    assert.equal((await media.arrayBuffer()).byteLength, 100);

    const cancelling = await app.request(`/api/scan/${started.job.id}`, { method: "DELETE" });
    assert.equal(cancelling.status, 200);
    assert.equal(((await cancelling.json()) as ScanJobSnapshot).status, "cancelling");
    assert.equal((await waitForTerminal(app, started.job.id)).status, "cancelled");
    assert.deepEqual(await adapter.getSettings(), settingsBeforeCancel);
    assert.equal(existsSync(orphanThumbnail), true);
    const worksAfterCancel = (await (await app.request("/api/works")).json()) as WorksPage;
    assert.deepEqual(
      worksAfterCancel.items.map((work) => [work.id, work.status]),
      worksBefore.items.map((work) => [work.id, work.status]),
    );

    Atomics.store(gate, 0, 1);
    Atomics.notify(gate, 0);
    const restartedResponse = await app.request("/api/scan", { method: "POST" });
    assert.equal(restartedResponse.status, 202);
    const restarted = (await restartedResponse.json()) as { job: ScanJobSnapshot };
    assert.equal((await waitForTerminal(app, restarted.job.id)).status, "completed");
  },
);

test("app shutdown は同期停止中のfile scan Workerを終了まで待機する", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(library.baseDir, "data", "db", "catalog.sqlite"),
    userPath: join(library.baseDir, "data", "db", "user.sqlite"),
  };
  const thumbnailCacheDir = join(library.baseDir, "data", "thumbnails");
  const seed = createTestRealAdapter({
    database,
    dataRoot: join(library.baseDir, "data"),
    thumbnailCacheDir,
  });
  await seed.updateSettings({ rootFolder: library.root });
  await scanAndRegisterCandidates(seed);
  seed.close();

  const gateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  let ready!: () => void;
  const workerReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const adapter = createTestRealAdapter({
    database,
    dataRoot: join(library.baseDir, "data"),
    thumbnailCacheDir,
    scanWorkerTestGate: gateBuffer,
    scanWorkerTestGateStage: "before-scan",
    onScanWorkerTestGateReady: ready,
  });
  t.after(() => adapter.close());
  const app = createApp(adapter);
  const startedResponse = await app.request("/api/scan", { method: "POST" });
  const started = (await startedResponse.json()) as { job: ScanJobSnapshot };
  await workerReady;

  await app.shutdown();

  assert.equal((await waitForTerminal(app, started.job.id)).status, "cancelled");
});

test("file scan Workerはfull:trueをscannerへ伝播し全件再処理する", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(library.baseDir, "data", "db", "catalog.sqlite"),
    userPath: join(library.baseDir, "data", "db", "user.sqlite"),
  };
  const thumbnailCacheDir = join(library.baseDir, "data", "thumbnails");
  const adapter = createTestRealAdapter({
    database,
    dataRoot: join(library.baseDir, "data"),
    thumbnailCacheDir,
  });
  t.after(() => adapter.close());
  await adapter.updateSettings({ rootFolder: library.root });
  await scanAndRegisterCandidates(adapter);

  const second = await adapter.scan({ full: true });
  assert.equal(second.skipped, 0);
  assert.equal(second.registered, 2);
});

test("file scan WorkerはMIMIMILLI_DLSITE_CACHE_DBで解決したDLsiteキャッシュを取得処理と共有する", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const dataRoot = join(library.baseDir, "data");
  const database = {
    kind: "files" as const,
    catalogPath: join(dataRoot, "db", "catalog.sqlite"),
    userPath: join(dataRoot, "db", "user.sqlite"),
  };
  const thumbnailCacheDir = join(dataRoot, "thumbnails");

  // 既定パス（旧ハードコード相当）は空のままにし、env override先だけへキャッシュを仕込む。
  const defaultCachePath = join(dataRoot, "db", "dlsite-cache.sqlite");
  const overrideCachePath = join(library.baseDir, "dlsite-cache-override.sqlite");
  const dlsiteCache = resolveDlsiteCacheConfig(defaultCachePath, {
    MIMIMILLI_DLSITE_CACHE_DB: overrideCachePath,
  });
  assert.equal(dlsiteCache.path, overrideCachePath);
  assert.notEqual(dlsiteCache.path, defaultCachePath);

  const seedCache = new DlsiteCache(dlsiteCache);
  seedCache.recordFailure({ productCode: "RJ900002", outcome: "not_found" });
  seedCache.close();
  assert.equal(existsSync(defaultCachePath), false);

  const adapter = createTestRealAdapter({ database, dataRoot, thumbnailCacheDir, dlsiteCache });
  t.after(() => adapter.close());
  await adapter.updateSettings({ rootFolder: library.root });
  await adapter.scan();

  const work = await adapter.getWork(library.existingWorkId);
  assert.equal(work?.dlsite.status, "not_found");
});
