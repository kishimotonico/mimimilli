import assert from "node:assert/strict";
import { test } from "node:test";
import type { DlsiteJobEvent, DlsiteProductFetchOutcome } from "@mimimilli/shared";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";

interface Call {
  code: string;
  force: boolean;
  signal: AbortSignal | undefined;
  settle(outcome: DlsiteProductFetchOutcome): void;
  fail(error: unknown): void;
}

function controlled() {
  const calls: Call[] = [];
  const manager = new DlsiteJobManager({
    fetchDlsiteProduct: (code, options) =>
      new Promise<DlsiteProductFetchOutcome>((resolve, reject) => {
        calls.push({
          code,
          force: options.force,
          signal: options.signal,
          settle: resolve,
          fail: reject,
        });
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
  });
  const events: DlsiteJobEvent[] = [];
  return { manager, calls, events };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function states(manager: DlsiteJobManager): Record<string, string> {
  return Object.fromEntries(
    (manager.getSnapshot()?.codes ?? []).map((code) => [code.productCode, code.state]),
  );
}

test("開始するとジョブIDを返し、キューを1件ずつ処理して終端状態と進捗を持つ", async () => {
  const { manager, calls } = controlled();
  assert.equal(manager.getSnapshot(), null);
  const jobId = manager.start({
    origin: "bulk",
    productCodes: ["RJ000001", "RJ000002", "RJ000003", "RJ000001"],
  });
  assert.equal(typeof jobId, "string");
  await tick();
  assert.deepEqual(states(manager), {
    RJ000001: "fetching",
    RJ000002: "queued",
    RJ000003: "queued",
  });
  assert.equal(calls.length, 1);
  calls[0]!.settle("fetched");
  await tick();
  calls[1]!.settle("not_found");
  await tick();
  calls[2]!.settle("failed");
  await tick();
  const snapshot = manager.getSnapshot()!;
  assert.equal(snapshot.jobId, jobId);
  assert.equal(snapshot.status, "finished");
  assert.deepEqual(states(manager), {
    RJ000001: "fetched",
    RJ000002: "not_found",
    RJ000003: "failed",
  });
  assert.deepEqual(snapshot.bulk, { processed: 3, total: 3 });
  assert.deepEqual(
    calls.map((call) => call.force),
    [false, false, false],
  );
});

test("実行中の取得は同じジョブへ合流し、コードごとの起点は変わらない", async () => {
  const { manager, calls } = controlled();
  const first = manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  const second = manager.start({ origin: "bulk", productCodes: ["RJ000002", "RJ000003"] });
  assert.equal(second, first);
  const bulkOnBulk = manager.start({ origin: "bulk", productCodes: ["RJ000001"] });
  assert.equal(bulkOnBulk, first);
  assert.deepEqual(
    manager.getSnapshot()?.codes.map((code) => [code.productCode, code.origin]),
    [
      ["RJ000001", "bulk"],
      ["RJ000002", "bulk"],
      ["RJ000003", "bulk"],
    ],
  );
  assert.equal(calls.length, 1);
  await manager.cancelActiveAndAwait();
});

test("単発は待機中の単発の末尾・まとめての前に入り、強制で取り直す", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002", "RJ000003"] });
  await tick();
  manager.start({ origin: "single", productCode: "RJ000010" });
  manager.start({ origin: "single", productCode: "RJ000011" });
  for (let index = 0; index < 5; index++) {
    calls[index]!.settle("fetched");
    await tick();
  }
  assert.deepEqual(
    calls.map((call) => [call.code, call.force]),
    [
      ["RJ000001", false],
      ["RJ000010", true],
      ["RJ000011", true],
      ["RJ000002", false],
      ["RJ000003", false],
    ],
  );
});

test("待機中のまとめてを単発で取り直すと単発へ移り、まとめての中止で消えない", async () => {
  const { manager, calls } = controlled();
  const jobId = manager.start({
    origin: "bulk",
    productCodes: ["RJ000001", "RJ000002", "RJ000003"],
  })!;
  await tick();
  manager.start({ origin: "single", productCode: "RJ000003" });
  assert.equal(manager.cancelBulk(jobId), 1);
  assert.deepEqual(states(manager), { RJ000001: "fetching", RJ000003: "queued" });
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(calls[1]!.code, "RJ000003");
  assert.equal(calls[1]!.force, true);
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(manager.getSnapshot()?.status, "finished");
  assert.deepEqual(manager.getSnapshot()?.bulk, { processed: 1, total: 1 });
});

test("取得を終えたコードの再要求は、その要求の起点とforceで再キューされる", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  calls[0]!.settle("failed");
  await tick();
  manager.start({ origin: "single", productCode: "RJ000001" });
  assert.deepEqual(
    manager.getSnapshot()?.codes.find((code) => code.productCode === "RJ000001"),
    { productCode: "RJ000001", origin: "single", state: "queued" },
  );
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(calls[2]!.code, "RJ000001");
  assert.equal(calls[2]!.force, true);
  calls[2]!.settle("fetched");
  await tick();
  assert.equal(manager.getSnapshot()?.status, "finished");
});

test("取得中のコードへの単発要求は、走行中の試行を終端にせずforceで取り直す", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  manager.start({ origin: "single", productCode: "RJ000001" });
  calls[0]!.settle("failed");
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.force, true);
  assert.deepEqual(states(manager), { RJ000001: "fetching" });
  calls[1]!.settle("fetched");
  await tick();
  assert.deepEqual(states(manager), { RJ000001: "fetched" });
  const terminalStates = events.flatMap((event) =>
    event.type === "code" && event.state !== "fetching" ? [event.state] : [],
  );
  assert.deepEqual(terminalStates, ["fetched"]);
});

test("中止は起点がまとめてで待機中のコードだけを外し、取得中と単発は止めない", async () => {
  const { manager, calls, events } = controlled();
  const jobId = manager.start({
    origin: "bulk",
    productCodes: ["RJ000001", "RJ000002", "RJ000003"],
  })!;
  await tick();
  manager.start({ origin: "single", productCode: "RJ000010" });
  manager.subscribe((event) => events.push(event));
  assert.equal(manager.cancelBulk("another-job"), 0);
  assert.equal(manager.cancelBulk(jobId), 2);
  assert.deepEqual(events.at(-1), {
    type: "removed",
    jobId,
    productCodes: ["RJ000002", "RJ000003"],
    bulk: { processed: 0, total: 1 },
  });
  assert.equal(calls[0]!.signal?.aborted, false);
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(calls[1]!.code, "RJ000010");
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(manager.getSnapshot()?.status, "finished");
  assert.equal(manager.cancelBulk(jobId), 0);
});

test("購読はsnapshotを返し、終端のfinishedで完了し、終了後も次のジョブ開始までsnapshotを保つ", async () => {
  const { manager, calls, events } = controlled();
  const idle = manager.subscribe(() => {});
  assert.deepEqual(idle.replay, [{ type: "snapshot", job: null }]);
  assert.equal(idle.live, false);

  const jobId = manager.start({ origin: "bulk", productCodes: ["RJ000001"] })!;
  await tick();
  const live = manager.subscribe((event) => events.push(event));
  assert.equal(live.live, true);
  assert.equal(live.replay[0]?.type, "snapshot");
  calls[0]!.settle("fetched");
  await tick();
  assert.deepEqual(
    events.map((event) => event.type),
    ["code", "finished"],
  );
  assert.deepEqual(events.at(-1), { type: "finished", jobId, reason: "complete" });

  const after = manager.subscribe(() => {});
  assert.equal(after.live, false);
  const replayed = after.replay[0];
  assert.equal(replayed?.type === "snapshot" ? replayed.job?.status : null, "finished");

  const next = manager.start({ origin: "single", productCode: "RJ000002" });
  assert.notEqual(next, jobId);
  await manager.cancelActiveAndAwait();
});

test("打ち切りはキューを全破棄してfinished(aborted)を送り、ジョブを切り離す", async () => {
  const { manager, calls, events } = controlled();
  const jobId = manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] })!;
  manager.start({ origin: "single", productCode: "RJ000010" });
  await tick();
  manager.subscribe((event) => events.push(event));
  const aborting = manager.cancelActiveAndAwait();
  assert.deepEqual(events, [{ type: "finished", jobId, reason: "aborted" }]);
  assert.equal(manager.getSnapshot(), null);
  assert.equal(calls[0]!.signal?.aborted, true);
  await aborting;
  assert.equal(calls.length, 1);
  assert.deepEqual(events.length, 1);
});

test("打ち切り中のstartは新しいジョブで処理され、古いループは何も送出しない", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001"] });
  await tick();
  const aborting = manager.cancelActiveAndAwait();
  const jobId = manager.start({ origin: "single", productCode: "RJ000002" })!;
  manager.subscribe((event) => events.push(event));
  await aborting;
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.code, "RJ000002");
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(manager.getSnapshot()?.jobId, jobId);
  assert.equal(manager.getSnapshot()?.status, "finished");
  assert.ok(events.every((event) => event.type !== "finished" || event.reason === "complete"));
});

test("取得の例外はそのコードのfailedになり、ジョブは続く", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  calls[0]!.fail(new Error("boom"));
  await tick();
  calls[1]!.settle("fetched");
  await tick();
  assert.deepEqual(states(manager), { RJ000001: "failed", RJ000002: "fetched" });
});

test("getInFlightStateは待機中・取得中だけを返す", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  assert.equal(manager.getInFlightState("RJ000001"), "fetching");
  assert.equal(manager.getInFlightState("RJ000002"), "queued");
  assert.equal(manager.getInFlightState("RJ000009"), null);
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(manager.getInFlightState("RJ000001"), null);
  await manager.cancelActiveAndAwait();
});

test("shutdownは実行中の取得を打ち切って完了を待ち、以降のstartを拒否する", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  await manager.shutdown();
  assert.equal(calls[0]!.signal?.aborted, true);
  assert.equal(calls.length, 1);
  assert.equal(manager.start({ origin: "single", productCode: "RJ000003" }), null);
});

test("走行中の試行がすでにforceなら、同じ単発が来ても取り直しを立てない", async () => {
  const { manager, calls } = controlled();
  manager.start({ origin: "single", productCode: "RJ000001" });
  await tick();
  manager.start({ origin: "single", productCode: "RJ000001" });
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(manager.getSnapshot()?.status, "finished");
});
