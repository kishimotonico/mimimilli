import assert from "node:assert/strict";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { ScanJobSnapshot, WorksPage } from "@mimimilli/shared";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

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

test("file scan Workerの同期停止中もworks/Range mediaへ応答し、cancel後に再scanできる", async (t) => {
  const library = makeSampleLibrary();
  t.after(library.cleanup);
  const database = {
    kind: "files" as const,
    catalogPath: join(library.baseDir, "data", "db", "catalog.sqlite"),
    userPath: join(library.baseDir, "data", "db", "user.sqlite"),
  };
  const thumbnailCacheDir = join(library.baseDir, "data", "thumbnails");

  const seed = createRealAdapter({
    database,
    dataRoot: join(library.baseDir, "data"),
    thumbnailCacheDir,
  });
  await seed.updateSettings({ rootFolder: library.root });
  await seed.scan();
  const settingsBeforeCancel = await seed.getSettings();
  seed.close();

  const gateBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const gate = new Int32Array(gateBuffer);
  let ready!: () => void;
  const workerReady = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const adapter = createRealAdapter({
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
  await Promise.race([
    workerReady,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Worker did not reach the test gate")), 2_000),
    ),
  ]);

  const withDeadline = async (
    request: Response | Promise<Response>,
    message = "operation timed out while Worker was blocked",
  ): Promise<Response> =>
    Promise.race([
      Promise.resolve(request),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(message)), 500)),
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
});
