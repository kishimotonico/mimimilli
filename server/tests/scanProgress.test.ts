import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createApp } from "./helpers/testApp.ts";
import type { DataAdapter, ScanExecution } from "../src/adapter/index.ts";
import { scanExecutionOf } from "./helpers/scanLibrary.ts";
import { scanRoute } from "../src/routes/scan.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";
import { pollUntil } from "./helpers/poll.ts";

function createScanJobManager(adapter: DataAdapter, terminalLimit?: number): ScanJobManager {
  return new ScanJobManager(adapter, { terminalLimit });
}

type EmitProgress = (processed: number) => void;

/** scanの進捗発行と完了をテストから操作できるadapter */
function createGatedScanAdapter(): {
  adapter: DataAdapter;
  progressReady: Promise<EmitProgress>;
  finishScan: () => void;
} {
  let resolveEmitProgress!: (emit: EmitProgress) => void;
  const progressReady = new Promise<EmitProgress>((resolve) => {
    resolveEmitProgress = resolve;
  });
  let finishScan!: () => void;
  const scanDone = new Promise<ScanExecution>((resolve) => {
    finishScan = () => resolve(scanExecutionOf(emptyResult));
  });
  const adapter: DataAdapter = {
    ...createFixtureAdapter(),
    scan: (options) => {
      const onProgress = options?.onProgress;
      resolveEmitProgress((processed) =>
        onProgress?.({ type: "progress", phase: "registering", processed, total: 10 }),
      );
      return scanDone;
    },
  };
  return { adapter, progressReady, finishScan: () => finishScan() };
}

async function readSseFrames(response: Response): Promise<Array<{ event: string; data: string }>> {
  const text = await response.text();
  return text
    .split("\n\n")
    .filter((frame) => frame.trim() !== "")
    .map((frame) => {
      const lines = frame.split("\n");
      assert.ok(!lines.some((line) => line.startsWith("id:")), "SSEフレームにidを付けないこと");
      const event = lines.find((line) => line.startsWith("event: "))?.slice("event: ".length);
      const data = lines.find((line) => line.startsWith("data: "))?.slice("data: ".length);
      return { event: event ?? "", data: data ?? "" };
    });
}

const emptyResult = {
  registered: 0,
  insertedWorkIds: [],
  startedWithEmptyCatalog: false,
  missingWorks: [],
  updatedWorks: [],
  unreadablePaths: [],
  errors: 0,
  missing: 0,
  skipped: 0,
  coverErrors: 0,
  identityConflicts: [],
  invalidMetaFiles: [],
  candidates: [],
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
  let job!: Record<string, unknown>;
  await pollUntil(async () => {
    const response = await app.request(`/api/scan/${id}`);
    job = (await response.json()) as Record<string, unknown>;
    return ["completed", "failed", "cancelled"].includes(job.status as string);
  });
  return job;
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

test("POST /scan は壊れたJSON・nullは400、非JSON bodyは415で拒否する", async () => {
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
  assert.equal(plain.status, 415);

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
  assert.equal("result" in job, false);
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

test("GET /scan/last は未スキャンなら finishedAt が null の空の記録、完了後は今回の記録を返す", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  const empty = await app.request("/api/scan/last");
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), {
    finishedAt: null,
    updatedWorks: [],
    missingWorks: [],
    unreadablePaths: [],
  });
  assert.equal((await (await app.request("/api/works?scanRecord=new")).json()).total, 0);

  const { id } = await start(app);
  await waitForTerminal(app, id);
  const body = await (await app.request("/api/scan/last")).json();
  assert.equal(typeof body.finishedAt, "string");
  assert.deepEqual(
    body.updatedWorks.map((work: { workId: string }) => work.workId),
    ["RJ501007", "RJ501002", "RJ501004"],
  );
  assert.deepEqual(
    body.missingWorks.map((work: { workId: string }) => work.workId),
    ["RJ501008"],
  );
  assert.deepEqual(body.unreadablePaths, ["権限なし/フォルダー"]);
  const created = await (await app.request("/api/works?scanRecord=new&sort=id-asc")).json();
  assert.deepEqual(
    created.items.map((item: { id: string }) => item.id),
    ["RJ501001", "RJ501003", "RJ501011"],
  );
});

test("候補から追加した作品は、スキャンで自動登録された作品とともに記録の新規作品に入る", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));
  await waitForTerminal(app, (await start(app)).id);
  const registered = await app.request("/api/scan/candidates/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paths: ["未登録作品"],
      apply: { title: true, cover: true, tags: true, url: true },
    }),
  });
  assert.equal(registered.status, 201);
  const { registered: entries } = await registered.json();
  const addedId = entries[0].workId as string;
  const ids = async () =>
    (await (await app.request("/api/works?scanRecord=new")).json()).items.map(
      (item: { id: string }) => item.id,
    );
  assert.ok((await ids()).includes(addedId));
  assert.ok((await ids()).includes("RJ501011"));
});

test("スキャン実行中に候補から追加した作品は、完了後の新規作品の記録にも残る", async () => {
  const { adapter, progressReady, finishScan } = createGatedScanAdapter();
  const manager = createScanJobManager(adapter);
  const job = manager.start();
  await progressReady;
  manager.session.record.addNewWorks(["added-during-scan"]);
  finishScan();
  await pollUntil(() => manager.get(job.id)?.status === "completed");
  assert.deepEqual(manager.session.record.workIds("new"), ["added-during-scan"]);
});

test("job scoped SSEは接続時に現在snapshotをstateで1件送り、以後のprogressとterminalをid無しで配信する", async () => {
  const { adapter, progressReady, finishScan } = createGatedScanAdapter();
  const manager = createScanJobManager(adapter);
  const app = new Hono();
  app.route("/", scanRoute(manager, { revision: () => 0 }));
  const job = manager.start();
  const emitProgress = await progressReady;
  emitProgress(1);

  // Last-Event-IDは読まないため、送っても接続時の現在snapshotから始まる
  const response = await app.request(`/scan/${job.id}/events`, {
    headers: { "Last-Event-ID": "0" },
  });
  assert.equal(response.status, 200);
  emitProgress(2);
  finishScan();
  const frames = await readSseFrames(response);

  assert.deepEqual(
    frames.map((frame) => frame.event),
    ["state", "progress", "completed"],
  );
  const initial = JSON.parse(frames[0]!.data);
  assert.equal(initial.type, "state");
  assert.equal(initial.snapshot.id, job.id);
  assert.equal(initial.snapshot.status, "running");
  assert.deepEqual(initial.snapshot.progress, { phase: "registering", processed: 1, total: 10 });
  assert.deepEqual(JSON.parse(frames[1]!.data), {
    type: "progress",
    progress: { phase: "registering", processed: 2, total: 10 },
  });
  assert.equal(JSON.parse(frames[2]!.data).type, "completed");
});

test("終了済みjobへの接続は終端snapshotのstateを1件送って閉じる", async () => {
  const app = createApp(createFixtureAdapter());
  const { id } = await start(app);
  const terminal = await waitForTerminal(app, id);

  const frames = await readSseFrames(await app.request(`/api/scan/${id}/events`));

  assert.deepEqual(frames, [
    { event: "state", data: JSON.stringify({ type: "state", snapshot: terminal }) },
  ]);
});

test("subscribeはsnapshot取得と購読を1手で行い、直後の完了を取りこぼさない", async () => {
  const { adapter, progressReady, finishScan } = createGatedScanAdapter();
  const manager = createScanJobManager(adapter);
  const job = manager.start();
  await progressReady;

  const received: string[] = [];
  const subscription = manager.subscribe(job.id, (event) => received.push(event.type));
  assert.equal(subscription?.snapshot.status, "running");
  finishScan();
  await pollUntil(() => manager.get(job.id)?.status === "completed");
  assert.deepEqual(received, ["completed"]);
  subscription?.unsubscribe();

  const afterTerminal: string[] = [];
  const late = manager.subscribe(job.id, (event) => afterTerminal.push(event.type));
  assert.equal(late?.snapshot.status, "completed");
  assert.deepEqual(afterTerminal, []);
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
            resolve(scanExecutionOf(emptyResult));
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
            resolve(scanExecutionOf(emptyResult));
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
      return Promise.resolve(scanExecutionOf(emptyResult));
    },
  } satisfies DataAdapter;
  const response = await createApp(adapter).request("/api/scan", { method: "POST" });
  assert.equal(response.status, 202);
  assert.equal(scanStarted, false);
});

test("terminal上限を超えたjobは404相当のnullになる", async () => {
  const manager = createScanJobManager(createFixtureAdapter(), 1);
  const first = manager.start();
  while (!manager.get(first.id)?.finishedAt) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  const second = manager.start();
  while (!manager.get(second.id)?.finishedAt) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(manager.get(first.id), null);
  assert.ok(manager.get(second.id));
});

test("進捗の無い区間でも一定間隔でpingを送り、完了時にハートビートを残さず閉じる", async () => {
  let finishScan!: () => void;
  const scanDone = new Promise<ScanExecution>((resolve) => {
    finishScan = () => resolve(scanExecutionOf(emptyResult));
  });
  const fixture = createFixtureAdapter();
  const adapter: DataAdapter = { ...fixture, scan: () => scanDone };
  const manager = createScanJobManager(adapter);
  const job = manager.start();

  // heartbeat間隔を20msに短縮したscanRouteだけを直に積んだ最小appでテストする
  const app = new Hono();
  app.route("/", scanRoute(manager, { revision: () => 0 }, 20));

  const response = await app.request(`/scan/${job.id}/events`);
  assert.equal(response.status, 200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while ([...buffer.matchAll(/event: ping/g)].length < 2) {
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
  }
  assert.ok(Date.now() - closedAt < 10_000, "完了後は速やかにストリームが閉じること");
});

test("スキャンが中止されると、実行中に候補から追加した作品の引き継ぎ履歴は捨てられる", async () => {
  const { adapter, progressReady, finishScan } = createGatedScanAdapter();
  const manager = createScanJobManager(adapter);
  const job = manager.start();
  await progressReady;
  manager.session.record.addNewWorks(["added-during-scan"]);
  manager.cancel(job.id);
  finishScan();
  await pollUntil(() => manager.get(job.id)?.status === "cancelled");
  manager.session.record.replace(
    {
      registered: 0,
      insertedWorkIds: [],
      startedWithEmptyCatalog: false,
      missingWorks: [],
      updatedWorks: [],
      errors: 0,
      missing: 0,
      skipped: 0,
      coverErrors: 0,
      unreadablePaths: [],
    },
    "t",
  );
  assert.deepEqual(manager.session.record.workIds("new"), []);
});
