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

test("getSnapshot は実行中ジョブと直近の終端をジョブID付きで返し、次のジョブ開始後も直近の終端を保つ", () => {
  const manager = createManager();
  assert.deepEqual(manager.getSnapshot(), { current: null, lastTerminal: null });

  const job = manager.startJob("job-1");
  const work = { id: "work-1", rjCode: "RJ111111", title: "作品1" };
  job.emit({ type: "progress", jobId: "job-1", processed: 2, total: 5, work });
  assert.deepEqual(manager.getSnapshot(), {
    current: { jobId: "job-1", status: "running", progress: { processed: 2, total: 5, work } },
    lastTerminal: null,
  });

  const result = { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 };
  job.emit({ type: "complete", jobId: "job-1", result });
  job.finish();
  assert.deepEqual(manager.getSnapshot(), {
    current: null,
    lastTerminal: { jobId: "job-1", status: "complete", result },
  });

  manager.startJob("job-2");
  assert.deepEqual(manager.getSnapshot(), {
    current: { jobId: "job-2", status: "running", progress: null },
    lastTerminal: { jobId: "job-1", status: "complete", result },
  });
});

test("DLsiteジョブは進捗を購読者へ配信し、完了を再接続時にreplayする", () => {
  const manager = createManager();
  const received: string[] = [];
  const job = manager.startJob("job-1");
  const subscription = manager.subscribe((event) => received.push(event.type));
  job.emit({
    type: "progress",
    jobId: "job-1",
    processed: 1,
    total: 2,
    work: { id: "work-1", rjCode: "RJ111111", title: "作品1" },
  });
  job.emit({
    type: "complete",
    jobId: "job-1",
    result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 },
  });
  job.finish();
  subscription.unsubscribe();
  assert.deepEqual(received, ["progress", "complete"]);

  const replay = manager.subscribe(() => {});
  assert.deepEqual(replay.replay, [
    {
      type: "complete",
      jobId: "job-1",
      result: { fetched: 1, failed: 1, parseErrors: 0, skipped: 0 },
    },
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

test("実行中のDLsite一括取得はcancel後にadapterがAbortErrorでrejectしてもcancelledを配信する", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk(
      _mode: string,
      _workIds: string[] | undefined,
      options?: { signal?: AbortSignal },
    ) {
      await gate;
      if (options?.signal?.aborted) {
        throw new DOMException("DLsiteリクエストはキャンセルされました", "AbortError");
      }
      return { fetched: 2, failed: 1, parseErrors: 0, skipped: 0 };
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
  assert.deepEqual(events.at(-1)?.result, { fetched: 0, failed: 0, parseErrors: 0, skipped: 0 });
});

test("adapterが通常例外でrejectした場合はerrorを配信する", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const adapter = {
    async runDlsiteBulk() {
      await gate;
      throw new Error("ネットワークエラー");
    },
  } as unknown as DataAdapter;
  const manager = createManager(adapter);
  const events: Array<{ type: string; message?: string }> = [];
  manager.enqueue("existing", undefined);
  await new Promise((resolve) => setImmediate(resolve));
  const subscription = manager.subscribe((event) => events.push(event));
  release();
  while (!events.some((event) => event.type === "error")) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  subscription.unsubscribe();
  assert.deepEqual(
    events.map((event) => event.type),
    ["error"],
  );
  assert.equal(events.at(-1)?.message, "ネットワークエラー");
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

test("enqueueのjobIdがイベントとsnapshotに載り、終端直後に次のジョブが始まるとcurrentとlastTerminalが別jobIdで両方返る", async () => {
  const gates: Array<() => void> = [];
  const adapter = {
    async runDlsiteBulk(
      _mode: string,
      _workIds: string[] | undefined,
      options?: {
        onProgress?: (progress: { processed: number; total: number; work: null }) => void;
      },
    ) {
      options?.onProgress?.({ processed: 0, total: 1, work: null });
      await new Promise<void>((resolve) => gates.push(resolve));
      return { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 };
    },
  } as unknown as DataAdapter;
  const manager = createManager(adapter);
  const events: Array<{ type: string; jobId: string }> = [];
  const firstId = manager.enqueue("existing", undefined);
  const secondId = manager.enqueue("new", ["new-work"]);
  assert.ok(firstId && secondId && firstId !== secondId);
  const subscription = manager.subscribe((event) => events.push(event));
  assert.equal(manager.getSnapshot().current?.jobId, firstId);

  gates.shift()!();
  while (gates.length === 0) await new Promise((resolve) => setImmediate(resolve));
  subscription.unsubscribe();

  assert.deepEqual(
    events.map((event) => [event.type, event.jobId]),
    [["complete", firstId]],
  );
  const snapshot = manager.getSnapshot();
  assert.equal(snapshot.current?.jobId, secondId);
  assert.deepEqual(snapshot.lastTerminal, {
    jobId: firstId,
    status: "complete",
    result: { fetched: 1, failed: 0, parseErrors: 0, skipped: 0 },
  });
  gates.shift()!();
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
