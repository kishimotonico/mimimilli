import assert from "node:assert/strict";
import { test } from "node:test";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import type { DataAdapter } from "../src/adapter/index.ts";

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

test("getSnapshot は実行中・終了後の状態を返す", () => {
  const manager = createManager();
  assert.equal(manager.getSnapshot(), null);

  const job = manager.startJob();
  job.emit({ type: "progress", processed: 2, total: 5, workId: "work-1" });
  assert.deepEqual(manager.getSnapshot(), {
    status: "running",
    progress: { processed: 2, total: 5 },
  });

  job.emit({ type: "complete", result: { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 } });
  job.finish();
  assert.deepEqual(manager.getSnapshot(), {
    status: "complete",
    result: { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 },
  });
});

test("DLsiteジョブは進捗を購読者へ配信し、完了を再接続時にreplayする", () => {
  const manager = createManager();
  const received: string[] = [];
  const job = manager.startJob();
  const subscription = manager.subscribe((event) => received.push(event.type));
  job.emit({ type: "progress", processed: 1, total: 2, workId: "work-1" });
  job.emit({ type: "complete", result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 } });
  job.finish();
  subscription.unsubscribe();
  assert.deepEqual(received, ["progress", "complete"]);

  const replay = manager.subscribe(() => {});
  assert.deepEqual(replay.replay, [
    { type: "complete", result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 } },
  ]);
});

test("実行中のDLsite一括取得はcancelで打ち切り、cancelledを配信する", async () => {
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
  const manager = createManager(adapter);

  manager.enqueue("existing", undefined);
  await new Promise((resolve) => setImmediate(resolve));
  const events: Array<{ type: string; result?: { fetched: number } }> = [];
  const subscription = manager.subscribe((event) => events.push(event));
  assert.equal(manager.cancel(), true);
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
  const manager = createManager(adapter);

  manager.enqueue("existing", undefined);
  manager.enqueue("new", ["queued-work"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(manager.cancel(), true);
  release();
  while (calls.length < 1) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ["existing"]);
});

test("実行中に追加された自動取得をFIFOで後続実行する", async () => {
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
  const manager = createManager(adapter);

  manager.enqueue("existing", undefined);
  manager.enqueue("new", ["new-work"]);
  assert.deepEqual(calls, [{ mode: "existing", workIds: undefined }]);

  releaseFirst();
  while (calls.length < 2) await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, [
    { mode: "existing", workIds: undefined },
    { mode: "new", workIds: ["new-work"] },
  ]);
});

test("createApp ごとに DLsite ジョブ状態が隔離される", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk(
      _mode: string,
      _workIds: string[] | undefined,
      options?: { signal?: AbortSignal },
    ) {
      await gate;
      options?.signal?.throwIfAborted();
      return { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
    },
  } as unknown as DataAdapter;

  const managerA = createManager(adapter);
  const managerB = createManager(adapter);
  managerA.enqueue("existing", undefined);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(managerA.isInProgress(), true);
  assert.equal(managerB.isInProgress(), false);
  release();
  await new Promise((resolve) => setImmediate(resolve));
});

test("shutdown は実行中ジョブを取消し、pending を破棄して完了を待つ", async () => {
  const calls: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk(
      mode: string,
      _workIds: string[] | undefined,
      options?: { signal?: AbortSignal },
    ) {
      calls.push(mode);
      await gate;
      const result = { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 };
      if (options?.signal?.aborted) return result;
      return result;
    },
  } as unknown as DataAdapter;
  const manager = createManager(adapter);

  manager.enqueue("existing", undefined);
  manager.enqueue("new", ["queued-work"]);
  await new Promise((resolve) => setImmediate(resolve));
  const events: string[] = [];
  manager.subscribe((event) => events.push(event.type));
  const shutdownPromise = manager.shutdown();
  release();
  await shutdownPromise;
  assert.deepEqual(calls, ["existing"]);
  assert.ok(events.includes("cancelling"));
  assert.ok(events.includes("cancelled"));
  assert.equal(manager.isInProgress(), false);
});
