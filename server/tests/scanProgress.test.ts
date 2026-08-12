import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "../src/app.ts";
import type { DataAdapter } from "../src/adapter/index.ts";
import { scanRoute } from "../src/routes/scan.ts";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";

function createScanJobManager(
  adapter: DataAdapter,
  historyLimit?: number,
  terminalLimit?: number,
): ScanJobManager {
  return new ScanJobManager(adapter, new DlsiteJobManager(adapter), historyLimit, terminalLimit);
}

const emptyResult = {
  registered: 0,
  newlyGenerated: 0,
  errors: 0,
  missing: 0,
  newWorkIds: [],
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
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

test("POST /scan はbody省略で202を返し、full:trueも受け付ける", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  const noBody = await app.request("/api/scan", { method: "POST" });
  assert.equal(noBody.status, 202);
  await waitForTerminal(app, (await noBody.json()).job.id);

  const full = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full: true }),
  });
  assert.equal(full.status, 202);
  await waitForTerminal(app, (await full.json()).job.id);
});

test("POST /scan は不正なbodyを400で拒否する", async () => {
  const app = createApp(createFixtureAdapter());
  const res = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full: "yes" }),
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, "invalid_request");
});

test("POST /scan は壊れたJSON・null・非JSON bodyを400で拒否する", async () => {
  const app = createApp(createFixtureAdapter());
  const broken = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{broken",
  });
  assert.equal(broken.status, 400);
  assert.equal((await broken.json()).error.code, "invalid_request");

  const nullBody = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null",
  });
  assert.equal(nullBody.status, 400);

  const plain = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "not-json",
  });
  assert.equal(plain.status, 400);

  const empty = await app.request("/api/scan", {
    method: "POST",
    headers: { "Content-Length": "0" },
  });
  assert.equal(empty.status, 202);
});

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

test("GET /scan/last は一度も完了していなければ204、完了後はディスク永続化なしで結果を返す", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  assert.equal((await app.request("/api/scan/last")).status, 204);

  const { id } = await start(app);
  await waitForTerminal(app, id);
  const last = await app.request("/api/scan/last");
  assert.equal(last.status, 200);
  const body = await last.json();
  assert.deepEqual(body.result.newWorkIds, ["RJ501011"]);
  assert.equal(typeof body.finishedAt, "string");
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

test("shutdown は実行中スキャンを取消して完了を待つ", async () => {
  let scanStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    scanStarted = resolve;
  });
  let abortObserved = false;
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    scan: (options) =>
      new Promise((resolve) => {
        scanStarted();
        options?.signal?.addEventListener(
          "abort",
          () => {
            abortObserved = true;
            resolve(emptyResult);
          },
          { once: true },
        );
      }),
  };
  const manager = createScanJobManager(adapter);
  const job = manager.start();
  await started;

  await manager.shutdown();

  assert.equal(abortObserved, true);
  assert.equal(manager.get(job.id)?.status, "cancelled");
  assert.equal(manager.getActive(), null);
});

test("app.shutdown は実行中スキャンの完了後に解決する", async () => {
  let scanStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    scanStarted = resolve;
  });
  let abortObserved = false;
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = {
    ...fixture,
    scan: (options) =>
      new Promise((resolve) => {
        scanStarted();
        options?.signal?.addEventListener(
          "abort",
          () => {
            abortObserved = true;
            resolve(emptyResult);
          },
          { once: true },
        );
      }),
  };
  const app = createApp(adapter);
  const { id } = await start(app);
  await started;

  await app.shutdown();

  assert.equal(abortObserved, true);
  const response = await app.request(`/api/scan/${id}`);
  assert.equal(response.status, 200);
  assert.equal(((await response.json()) as { status: string }).status, "cancelled");
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
  const manager = createScanJobManager(createFixtureAdapter(), 2, 1);
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
      const onProgress = options?.onProgress;
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
  const manager = createScanJobManager(adapter, 2, 2);
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
  const manager = createScanJobManager(adapter);
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
