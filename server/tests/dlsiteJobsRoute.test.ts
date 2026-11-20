import assert from "node:assert/strict";
import { test } from "node:test";
import { Hono } from "hono";
import type { DlsiteTerminalProductSummary } from "@mimimilli/shared";
import type { DataAdapter } from "../src/adapter/index.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import { dlsiteRoute } from "../src/routes/dlsite.ts";
import { createApp } from "./helpers/testApp.ts";

function gatedManager() {
  const gates: Array<(outcome: "fetched" | "not_found" | "failed") => void> = [];
  const manager = new DlsiteJobManager({
    fetchDlsiteProduct: (_code, options) =>
      new Promise<DlsiteTerminalProductSummary>((resolve, reject) => {
        gates.push((state) =>
          resolve(state === "fetched" ? { state, title: "タイトル", cover: null } : { state }),
        );
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          {
            once: true,
          },
        );
      }),
  });
  return { manager, gates };
}

function routeApp(manager: DlsiteJobManager, heartbeatIntervalMs?: number): Hono {
  const app = new Hono();
  app.route("/", dlsiteRoute(createFixtureAdapter(), manager, heartbeatIntervalMs));
  return app;
}

function listenerCount(manager: DlsiteJobManager): number {
  const job = (manager as unknown as { job: { listeners: Set<unknown> } | null }).job;
  return job?.listeners.size ?? 0;
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

async function drainReader(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
  for (;;) {
    const { done } = await reader.read();
    if (done) return;
  }
}

test("GET /dlsite/jobs/events はsnapshotを先頭に、コードの状態とfinishedを順に配信して閉じる", async () => {
  const { manager, gates } = gatedManager();
  const app = routeApp(manager);
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();

  const live = await app.request("/dlsite/jobs/events");
  assert.equal(live.status, 200);
  const textPromise = live.text();
  gates[0]!("fetched");
  await tick();
  gates[1]!("not_found");

  const text = await textPromise;
  const names = [...text.matchAll(/^event: (\w+)$/gm)].map((match) => match[1]);
  assert.equal(names[0], "snapshot");
  assert.equal(names.at(-1), "finished");
  assert.ok(names.includes("code"));
  assert.match(text, /"reason":"complete"/);
});

test("終了後の接続はfinishedのsnapshotを返してすぐ閉じ、ジョブが無ければjob:nullを返す", async () => {
  const { manager, gates } = gatedManager();
  const app = routeApp(manager);
  const empty = await (await app.request("/dlsite/jobs/events")).text();
  assert.match(empty, /event: snapshot/);
  assert.match(empty, /"job":null/);

  manager.start({ productCodes: ["RJ000001"] });
  await tick();
  gates[0]!("fetched");
  await tick();
  const replay = await (await app.request("/dlsite/jobs/events")).text();
  assert.match(replay, /"status":"finished"/);
});

test("SSE切断後の書込失敗でもhandlerが永久待機しない", async () => {
  const { manager, gates } = gatedManager();
  const app = routeApp(manager);
  manager.start({ productCodes: ["RJ000001"] });
  await tick();

  const response = await app.request("/dlsite/jobs/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  const handlerDone = drainReader(reader);

  gates[0]!("fetched");
  await handlerDone;

  const replay = await app.request("/dlsite/jobs/events");
  assert.equal(replay.status, 200);
  assert.match(await replay.text(), /"status":"finished"/);
});

test("終端前の切断でもunsubscribeされ後続接続が成立する", async () => {
  const { manager, gates } = gatedManager();
  const app = routeApp(manager);
  manager.start({ productCodes: ["RJ000001"] });
  await tick();

  const response = await app.request("/dlsite/jobs/events");
  const reader = response.body!.getReader();
  await reader.read();
  await reader.cancel();
  await drainReader(reader);
  const deadline = Date.now() + 500;
  while (listenerCount(manager) > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(listenerCount(manager), 0);

  gates[0]!("fetched");
  await tick();
  const replay = await app.request("/dlsite/jobs/events");
  assert.match(await replay.text(), /event: snapshot/);
});

test("無音の間もheartbeatのpingを送り続ける", async () => {
  const { manager } = gatedManager();
  const app = routeApp(manager, 10);
  manager.start({ productCodes: ["RJ000001"] });
  await tick();

  const response = await app.request("/dlsite/jobs/events");
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 1000;
  while ((text.match(/event: ping/g)?.length ?? 0) < 2 && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  assert.ok((text.match(/event: ping/g)?.length ?? 0) >= 2);
  await reader.cancel();
  await manager.cancelActiveAndAwait();
});

test("createApp経由で開始したジョブの進捗をSSEで全部受信する", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const adapter: DataAdapter = {
    ...createFixtureAdapter(),
    fetchDlsiteProduct: async () => {
      await gate;
      return { state: "fetched", title: "タイトル", cover: null };
    },
  };
  const app = createApp(adapter);

  await app.request("/api/dlsite/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productCodes: ["RJ000001"] }),
  });
  const stream = await app.request("/api/dlsite/jobs/events");
  assert.equal(stream.status, 200);
  const textPromise = stream.text();
  release();
  const text = await textPromise;
  assert.match(text, /event: snapshot/);
  assert.match(text, /event: code/);
  assert.match(text, /event: finished/);
});

test("createApp ごとにDLsiteジョブ状態が隔離される", async () => {
  const appA = createApp(createFixtureAdapter());
  const appB = createApp(createFixtureAdapter());
  await appA.request("/api/dlsite/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productCodes: ["RJ000001"] }),
  });
  await tick();
  assert.equal((await (await appB.request("/api/dlsite/jobs/current")).json()).job, null);
  assert.notEqual((await (await appA.request("/api/dlsite/jobs/current")).json()).job, null);
});
