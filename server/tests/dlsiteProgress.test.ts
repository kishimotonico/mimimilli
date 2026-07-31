import assert from "node:assert/strict";
import { test } from "node:test";
import {
  cancelDlsiteJob,
  enqueueDlsiteJob,
  getDlsiteBulkSnapshot,
  resetDlsiteProgressStateForTest,
  startDlsiteJob,
  subscribeToDlsite,
} from "../src/routes/dlsiteProgress.ts";
import type { DataAdapter } from "../src/adapter.ts";

test("getDlsiteBulkSnapshot は実行中・終了後の状態を返す", () => {
  resetDlsiteProgressStateForTest();
  assert.equal(getDlsiteBulkSnapshot(), null);

  const job = startDlsiteJob();
  job.emit({ type: "progress", processed: 2, total: 5, workId: "work-1" });
  assert.deepEqual(getDlsiteBulkSnapshot(), {
    status: "running",
    progress: { processed: 2, total: 5 },
  });

  job.emit({ type: "complete", result: { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 } });
  job.finish();
  assert.deepEqual(getDlsiteBulkSnapshot(), {
    status: "complete",
    result: { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 },
  });
});

test("DLsiteジョブは進捗を購読者へ配信し、完了を再接続時にreplayする", () => {
  resetDlsiteProgressStateForTest();
  const received: string[] = [];
  const job = startDlsiteJob();
  const subscription = subscribeToDlsite((event) => received.push(event.type));
  job.emit({ type: "progress", processed: 1, total: 2, workId: "work-1" });
  job.emit({ type: "complete", result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 } });
  job.finish();
  subscription.unsubscribe();
  assert.deepEqual(received, ["progress", "complete"]);

  const replay = subscribeToDlsite(() => {});
  assert.deepEqual(replay.replay, [
    { type: "complete", result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 } },
  ]);
});

test("実行中のDLsite一括取得はcancelで打ち切り、cancelledを配信する", async () => {
  resetDlsiteProgressStateForTest();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk(
      _mode: string,
      _workIds: string[] | undefined,
      options?: { signal?: AbortSignal },
    ) {
      await gate;
      const result = { fetched: 2, failed: 1, parseErrors: 0, skipped: 0 };
      if (options?.signal?.aborted) return result;
      return result;
    },
  } as unknown as DataAdapter;

  enqueueDlsiteJob(adapter, "existing", undefined);
  await new Promise((resolve) => setImmediate(resolve));
  const events: Array<{ type: string; result?: { fetched: number } }> = [];
  const subscription = subscribeToDlsite((event) => events.push(event));
  assert.equal(cancelDlsiteJob(), true);
  release();
  while (events.at(-1)?.type !== "cancelled") await new Promise((resolve) => setImmediate(resolve));
  subscription.unsubscribe();
  assert.deepEqual(
    events.map((event) => event.type),
    ["cancelling", "cancelled"],
  );
  assert.deepEqual(events.at(-1)?.result, { fetched: 2, failed: 1, parseErrors: 0, skipped: 0 });
});

test("中止時はキューに積まれた未実行ジョブを破棄する", async () => {
  resetDlsiteProgressStateForTest();
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk(mode: string) {
      calls.push(mode);
      if (calls.length === 1) await gate;
      return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
    },
  } as unknown as DataAdapter;

  enqueueDlsiteJob(adapter, "existing", undefined);
  enqueueDlsiteJob(adapter, "new", ["queued-work"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(cancelDlsiteJob(), true);
  release();
  while (calls.length < 1) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["existing"]);
});

test("実行中に追加された自動取得をFIFOで後続実行する", async () => {
  resetDlsiteProgressStateForTest();
  const calls: Array<{ mode: string; workIds: string[] | undefined }> = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
  const adapter = {
    async runDlsiteBulk(
      mode: string,
      workIds: string[] | undefined,
      _options?: { signal?: AbortSignal },
    ) {
      calls.push({ mode, workIds });
      if (calls.length === 1) await firstGate;
      return { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 };
    },
  } as unknown as DataAdapter;

  enqueueDlsiteJob(adapter, "existing", undefined);
  enqueueDlsiteJob(adapter, "new", ["new-work"]);
  assert.deepEqual(calls, [{ mode: "existing", workIds: undefined }]);

  releaseFirst();
  while (calls.length < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    { mode: "existing", workIds: undefined },
    { mode: "new", workIds: ["new-work"] },
  ]);
});
