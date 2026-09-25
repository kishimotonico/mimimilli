// app.ts の配線: スキャン完了で新規作品があるとDLsite一括取得ジョブが1件積まれる。
// ScanJobManager単体の挙動はscanJobManagerDlsiteEnqueue.test.tsで検証済み。ここではapp.ts経由の
// 実配線（ScanJobManager→完了コールバック→DlsiteJobManager.enqueue）を確認する。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { pollUntil } from "./helpers/poll.ts";

async function waitForScanTerminal(app: ReturnType<typeof createApp>, id: string): Promise<void> {
  await pollUntil(async () => {
    const res = await app.request(`/api/scan/${id}`);
    const job = (await res.json()) as { status: string };
    return ["completed", "failed", "cancelled"].includes(job.status);
  });
}

test("スキャン完了でinsertedWorkIdsがあればDLsite一括取得ジョブが積まれる", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "new-work" }));

  const start = await app.request("/api/scan", { method: "POST" });
  assert.equal(start.status, 202);
  const { job } = await start.json();
  await waitForScanTerminal(app, job.id);

  // enqueueは同期的にキュー投入されるため、完了直後にはジョブが存在するはず。
  const bulk = await app.request("/api/dlsite/bulk");
  const snapshot = await bulk.json();
  assert.ok(snapshot.current !== null || snapshot.lastTerminal !== null);
});

test("スキャン完了でinsertedWorkIdsが無ければDLsite一括取得ジョブは積まれない", async () => {
  const app = createApp(createFixtureAdapter({ scenario: "empty" }));

  const start = await app.request("/api/scan", { method: "POST" });
  assert.equal(start.status, 202);
  const { job } = await start.json();
  await waitForScanTerminal(app, job.id);

  const bulk = await app.request("/api/dlsite/bulk");
  assert.deepEqual(await bulk.json(), { current: null, lastTerminal: null });
});
