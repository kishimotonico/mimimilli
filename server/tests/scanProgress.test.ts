import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";
import type { DataAdapter } from "../src/adapter.ts";
import { scanRoute } from "../src/routes/scan.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";

const emptyResult = {
  registered: 0,
  newlyGenerated: 0,
  errors: 0,
  missing: 0,
  newWorkIds: [],
  rjCodeMissingCount: 0,
  skipped: 0,
};

async function start(
  app: ReturnType<typeof createApp>,
): Promise<{ id: string; location: string | null }> {
  const response = await app.request("/api/scan", { method: "POST" });
  assert.equal(response.status, 202);
  const body = await response.json();
  return { id: body.job.id, location: response.headers.get("location") };
}

async function waitForTerminal(
  app: ReturnType<typeof createApp>,
  id: string,
): Promise<Record<string, unknown>> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const response = await app.request(`/api/scan/${id}`);
    const job = (await response.json()) as Record<string, unknown>;
    if (["completed", "failed", "cancelled"].includes(job.status as string)) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("scan job did not finish");
}

test("POST /scan は202とLocationを即時返し、完了状態はjobから取得できる", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  const { id, location } = await start(app);
  assert.equal(location, `/api/scan/${id}`);
  const job = await waitForTerminal(app, id);
  assert.equal(job.status, "completed");
  assert.deepEqual((job.result as { newWorkIds: string[] }).newWorkIds, ["RJ501011"]);
});

test("active jobは409でsnapshotを返し、終了後はactiveが204になる", async () => {
  const app = createApp(createFixtureAdapter());
  const { id } = await start(app);
  const conflict = await app.request("/api/scan", { method: "POST" });
  assert.equal(conflict.status, 409);
  assert.equal((await conflict.json()).active.id, id);
  await waitForTerminal(app, id);
  assert.equal((await app.request("/api/scan/active")).status, 204);
});

test("job scoped SSEはprogressとterminalをseq付きで配信し、Last-Event-IDをreplayする", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  const { id } = await start(app);
  const stream = await app.request(`/api/scan/${id}/events`);
  assert.equal(stream.status, 200);
  const text = await stream.text();
  assert.match(text, /event: progress/);
  assert.match(text, /event: completed/);
  assert.match(text, /id: \d+/);
  const terminalSeq = [...text.matchAll(/^id: (\d+)$/gm)].at(-1)?.[1];
  assert.ok(terminalSeq);
  const afterTerminal = await app.request(`/api/scan/${id}/events`, {
    headers: { "Last-Event-ID": terminalSeq },
  });
  assert.equal(await afterTerminal.text(), "");
  const replay = await app.request(`/api/scan/${id}/events`, { headers: { "Last-Event-ID": "0" } });
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /event: completed/);
});

test("SSE subscriberが切断してもjobは継続する", async () => {
  const app = createApp(createFixtureAdapter());
  const { id } = await start(app);
  const stream = await app.request(`/api/scan/${id}/events`);
  const reader = stream.body!.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal((await waitForTerminal(app, id)).status, "completed");
});

test("DELETE /scan/:id は取消を要求し、終了済みjobには冪等", async () => {
  const app = createApp(createFixtureAdapter());
  const { id } = await start(app);
  const cancelling = await app.request(`/api/scan/${id}`, { method: "DELETE" });
  assert.equal(cancelling.status, 200);
  assert.ok(["cancelling", "cancelled"].includes((await cancelling.json()).status));
  const terminal = await waitForTerminal(app, id);
  assert.equal(terminal.status, "cancelled");
  assert.equal((await app.request(`/api/scan/${id}`, { method: "DELETE" })).status, 200);
});

test("unknown jobは404", async () => {
  const app = createApp(createFixtureAdapter());
  assert.equal((await app.request("/api/scan/missing")).status, 404);
  assert.equal((await app.request("/api/scan/missing/events")).status, 404);
});

test("同期的に重いadapterでもPOST応答のcall stackではscanを開始しない", async () => {
  let scanStarted = false;
  const fixture = createFixtureAdapter();
  const adapter = {
    ...fixture,
    scan: () => {
      scanStarted = true;
      const until = performance.now() + 25;
      while (performance.now() < until) {
        // 同期処理を模擬する。
      }
      return Promise.resolve(emptyResult);
    },
  } satisfies DataAdapter;
  const response = await createApp(adapter).request("/api/scan", { method: "POST" });
  assert.equal(response.status, 202);
  assert.equal(scanStarted, false);
});

test("history切詰時はresetし、terminal上限を超えたjobは404相当のnullになる", async () => {
  const manager = new ScanJobManager(createFixtureAdapter(), 2, 1);
  const first = manager.start();
  while (!manager.get(first.id)?.finishedAt) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const replay = manager.subscribe(first.id, 0, () => {});
  assert.equal(replay?.initial[0]?.type, "reset");
  const resetSeq = replay?.initial[0]?.seq;
  assert.ok(resetSeq !== undefined);
  replay?.unsubscribe();
  const afterReset = manager.subscribe(first.id, resetSeq, () => {});
  assert.deepEqual(afterReset?.initial, []);
  afterReset?.unsubscribe();

  const second = manager.start();
  while (!manager.get(second.id)?.finishedAt) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manager.get(first.id), null);
  assert.ok(manager.get(second.id));
});

test("reset IDで即再接続すると古い履歴を再送せず、以後のlive eventだけを受け取る", async () => {
  type EmitProgress = (processed: number) => void;
  let resolveEmitProgress!: (emit: EmitProgress) => void;
  const emitProgressReady = new Promise<EmitProgress>((resolve) => {
    resolveEmitProgress = resolve;
  });
  let finishScan!: () => void;
  const scanDone = new Promise<typeof emptyResult>((resolve) => {
    finishScan = () => resolve(emptyResult);
  });
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    scan: (options) => {
      const onProgress = typeof options === "function" ? options : options?.onProgress;
      resolveEmitProgress((processed) =>
        onProgress?.({
          type: "progress",
          phase: "registering",
          processed,
          total: 10,
        }),
      );
      return scanDone;
    },
  };
  const manager = new ScanJobManager(adapter, 2, 2);
  const job = manager.start();
  const emitProgress = await emitProgressReady;
  emitProgress(1);
  emitProgress(2);
  emitProgress(3);

  const reset = manager.subscribe(job.id, 0, () => {});
  assert.equal(reset?.initial.length, 1);
  assert.equal(reset?.initial[0]?.type, "reset");
  const resetSeq = reset!.initial[0]!.seq;
  reset?.unsubscribe();

  const live: Array<{ seq: number }> = [];
  const reconnected = manager.subscribe(job.id, resetSeq, (event) => live.push(event));
  assert.deepEqual(reconnected?.initial, []);
  emitProgress(4);
  assert.deepEqual(
    live.map((event) => event.seq),
    [resetSeq + 1],
  );
  reconnected?.unsubscribe();
  finishScan();
  while (!manager.get(job.id)?.finishedAt) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
});

test("進捗の無い区間でも一定間隔でpingを送り、完了時にハートビートを残さず閉じる", async () => {
  let finishScan!: () => void;
  const scanDone = new Promise<typeof emptyResult>((resolve) => {
    finishScan = () => resolve(emptyResult);
  });
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = { ...fixture, scan: () => scanDone };
  const manager = new ScanJobManager(adapter);
  const job = manager.start();

  // heartbeat間隔を20msに短縮したscanRouteだけを直に積んだ最小appでテストする
  const app = new Hono();
  app.route("/", scanRoute(manager, 20));

  const response = await app.request(`/scan/${job.id}/events`);
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const deadline = Date.now() + 2000;
  while ([...buffer.matchAll(/event: ping/g)].length < 2 && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value);
  }
  const pingCount = [...buffer.matchAll(/event: ping/g)].length;
  assert.ok(pingCount >= 2, `無音区間中にpingが複数回送られること (got ${pingCount})`);

  // 完了イベント配信後、ハートビートのタイマーも解放されてストリームが閉じること
  finishScan();
  const closedAt = Date.now();
  for (;;) {
    const { done } = await reader.read();
    if (done) break;
    assert.ok(Date.now() - closedAt < 2000, "完了後は速やかにストリームが閉じること");
  }
});
