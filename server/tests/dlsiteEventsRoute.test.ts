import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import type { DlsiteBulkResult } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";
import type { DataAdapter } from "../src/adapter/index.ts";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import { dlsiteRoute } from "../src/routes/dlsite.ts";

function createManager(adapter?: DataAdapter): DlsiteJobManager {
  return new DlsiteJobManager(
    adapter ??
      ({
        async runDlsiteBulk() {
          return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
        },
      } as unknown as DataAdapter),
  );
}

const emptyResult: DlsiteBulkResult = { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 };

const progressWork = { id: "work-1", rjCode: "RJ111111", title: "作品" };

function activeListenerCount(manager: DlsiteJobManager): number {
  const current = (manager as unknown as { currentJob: { listeners: Set<unknown> } | null })
    .currentJob;
  return current?.listeners.size ?? 0;
}

async function drainReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

test("GET /dlsite/events は進捗とterminalを配信し完了後はreplayする", async () => {
  const manager = createManager();
  const app = new Hono();
  app.route("/", dlsiteRoute(createFixtureAdapter(), manager));

  const job = manager.startJob("job-1");
  job.emit({ type: "progress", jobId: "job-1", processed: 1, total: 2, work: progressWork });

  const live = await app.request("/dlsite/events");
  assert.equal(live.status, 200);

  job.emit({ type: "complete", jobId: "job-1", result: emptyResult });
  job.finish();

  const text = await live.text();
  assert.match(text, /event: progress/);
  assert.match(text, /event: complete/);

  const replay = await app.request("/dlsite/events");
  assert.match(await replay.text(), /event: complete/);
});

test("SSE切断後の書込失敗でもhandlerが永久待機しない", async () => {
  const manager = createManager();
  const app = new Hono();
  app.route("/", dlsiteRoute(createFixtureAdapter(), manager));

  const job = manager.startJob("job-1");
  job.emit({ type: "progress", jobId: "job-1", processed: 1, total: 2, work: progressWork });

  const response = await app.request("/dlsite/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();

  const handlerDone = drainReader(reader);

  job.emit({ type: "complete", jobId: "job-1", result: emptyResult });
  job.finish();

  await handlerDone;

  const replay = await app.request("/dlsite/events");
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /event: complete/);
});

test("terminal前の切断でもunsubscribeされ後続接続が成立する", async () => {
  const manager = createManager();
  const app = new Hono();
  app.route("/", dlsiteRoute(createFixtureAdapter(), manager));

  const job = manager.startJob("job-1");
  job.emit({ type: "progress", jobId: "job-1", processed: 1, total: 2, work: progressWork });

  const response = await app.request("/dlsite/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();

  await drainReader(reader);

  job.emit({ type: "complete", jobId: "job-1", result: emptyResult });
  job.finish();

  const replay = await app.request("/dlsite/events");
  assert.match(await replay.text(), /event: complete/);
});

test("切断直後のterminal書込失敗でもactive listenerが残らない", async () => {
  const manager = createManager();
  const app = new Hono();
  app.route("/", dlsiteRoute(createFixtureAdapter(), manager));

  const job = manager.startJob("job-1");
  job.emit({ type: "progress", jobId: "job-1", processed: 1, total: 2, work: progressWork });

  const response = await app.request("/dlsite/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();

  job.emit({ type: "complete", jobId: "job-1", result: emptyResult });

  await drainReader(reader);
  const deadline = Date.now() + 500;
  while (activeListenerCount(manager) > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(activeListenerCount(manager), 0);

  job.finish();
});

test("createApp経由の一括取得完了時にSSEで全イベントを受信する", async () => {
  let resolveBulk!: () => void;
  const bulkDone = new Promise<void>((resolve) => {
    resolveBulk = resolve;
  });
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    runDlsiteBulk: async (_mode, _workIds, options) => {
      options?.onProgress?.({
        processed: 1,
        total: 1,
        work: progressWork,
      });
      await bulkDone;
      return { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 };
    },
  };
  const app = createApp(adapter);

  await app.request("/api/dlsite/bulk", { method: "POST" });
  const stream = await app.request("/api/dlsite/events");
  assert.equal(stream.status, 200);

  const textPromise = stream.text();
  resolveBulk();

  const text = await textPromise;
  assert.match(text, /event: progress/);
  assert.match(text, /event: complete/);
});
