import assert from "node:assert/strict";
import { test } from "node:test";
import type { DlsiteJobEvent, DlsiteTerminalProductSummary } from "@mimimilli/shared";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";

interface Call {
  code: string;
  force: boolean;
  signal: AbortSignal | undefined;
  settle(outcome: DlsiteTerminalProductSummary["state"]): void;
  fail(error: unknown): void;
}

const summaryOf = (state: DlsiteTerminalProductSummary["state"]): DlsiteTerminalProductSummary =>
  state === "fetched" ? { state, title: "タイトル", cover: null } : { state };

function controlled(now?: () => number) {
  const calls: Call[] = [];
  const manager = new DlsiteJobManager(
    {
      fetchDlsiteProduct: (code, options) =>
        new Promise<DlsiteTerminalProductSummary>((resolve, reject) => {
          calls.push({
            code,
            force: options.force,
            signal: options.signal,
            settle: (state) => resolve(summaryOf(state)),
            fail: reject,
          });
          options.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true },
          );
        }),
    },
    { now },
  );
  const events: DlsiteJobEvent[] = [];
  return { manager, calls, events };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

function states(manager: DlsiteJobManager): Record<string, string> {
  return Object.fromEntries(
    (manager.getState().job?.codes ?? []).map((code) => [code.productCode, code.state]),
  );
}

test("開始するとジョブIDを返し、キューを1件ずつ処理して終端状態と進捗を持つ", async () => {
  const { manager, calls } = controlled();
  assert.equal(manager.getState().job, null);
  const jobId = manager.start({
    productCodes: ["RJ000001", "RJ000002", "RJ000003", "RJ000001"],
  })!.job!.jobId;
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
  const snapshot = manager.getState().job!;
  assert.equal(snapshot.jobId, jobId);
  assert.equal(snapshot.status, "finished");
  assert.deepEqual(states(manager), {
    RJ000001: "fetched",
    RJ000002: "not_found",
    RJ000003: "failed",
  });
  assert.deepEqual(snapshot.progress, { processed: 3, total: 3 });
  assert.deepEqual(
    calls.map((call) => call.force),
    [false, false, false],
  );
});

test("実行中の取得は同じジョブへ合流し、重複したコードは増えない", async () => {
  const { manager, calls } = controlled();
  const first = manager.start({ productCodes: ["RJ000001", "RJ000002"] })!.job!.jobId;
  await tick();
  const second = manager.start({ productCodes: ["RJ000002", "RJ000003"] })!.job!.jobId;
  assert.equal(second, first);
  assert.equal(manager.start({ productCodes: ["RJ000001"] })!.job!.jobId, first);
  assert.deepEqual(
    manager.getState().job?.codes.map((code) => code.productCode),
    ["RJ000001", "RJ000002", "RJ000003"],
  );
  assert.equal(calls.length, 1);
  await manager.cancelActiveAndAwait();
});

test("forceなしの要求は失敗の記録を使い、force付きは取り直す。合流したコードは末尾に入る", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002", "RJ000003"] });
  await tick();
  manager.start({ productCodes: ["RJ000010"], force: true });
  for (let index = 0; index < 4; index++) {
    calls[index]!.settle("fetched");
    await tick();
  }
  assert.deepEqual(
    calls.map((call) => [call.code, call.force]),
    [
      ["RJ000001", false],
      ["RJ000002", false],
      ["RJ000003", false],
      ["RJ000010", true],
    ],
  );
});

test("取得を終えたコードのforce付き再要求は、forceで再キューされる。forceなしはforceなしで再キューされる", async () => {
  const { manager, calls } = controlled(() => 1_700_000_000_000);
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  calls[0]!.settle("failed");
  await tick();
  manager.start({ productCodes: ["RJ000001"], force: true });
  assert.deepEqual(
    manager.getState().job?.codes.find((code) => code.productCode === "RJ000001"),
    { productCode: "RJ000001", state: "queued", revision: manager.revision },
  );
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(calls[2]!.code, "RJ000001");
  assert.equal(calls[2]!.force, true);
  calls[2]!.settle("fetched");
  await tick();
  assert.equal(manager.getState().job?.status, "finished");
});

test("forceは失敗の記録を無視して取り直し、待機中・取得中のコードにも効く", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  calls[0]!.settle("failed");
  await tick();
  manager.start({ productCodes: ["RJ000001", "RJ000002"], force: true });
  calls[1]!.settle("failed");
  await tick();
  assert.equal(calls[2]!.code, "RJ000002");
  assert.equal(calls[2]!.force, true);
  calls[2]!.settle("fetched");
  await tick();
  assert.equal(calls[3]!.code, "RJ000001");
  assert.equal(calls[3]!.force, true);
  calls[3]!.settle("fetched");
  await tick();
  assert.equal(manager.getState().job?.status, "finished");
});

test("取得中のコードへのforce付き要求は、走行中の試行を終端にせずforceで取り直す", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ productCodes: ["RJ000001"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  manager.start({ productCodes: ["RJ000001"], force: true });
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

test("中止は待機中のコードを合流したものも含めて外し、取得中のコードは止めない", async () => {
  const { manager, calls, events } = controlled(() => 1_700_000_000_000);
  const jobId = manager.start({
    productCodes: ["RJ000001", "RJ000002", "RJ000003"],
  })!.job!.jobId;
  await tick();
  manager.start({ productCodes: ["RJ000010"], force: true });
  manager.subscribe((event) => events.push(event));
  assert.equal(manager.cancel("another-job"), 0);
  assert.equal(manager.cancel(jobId), 3);
  assert.deepEqual(events.at(-1), {
    type: "removed",
    revision: manager.revision,
    jobId,
    productCodes: ["RJ000002", "RJ000003", "RJ000010"],
    progress: { processed: 0, total: 1 },
  });
  assert.equal(calls[0]!.signal?.aborted, false);
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(manager.getState().job?.status, "finished");
  assert.equal(manager.cancel(jobId), 0);
});

test("購読はsnapshotを返し、終端のfinishedで完了し、終了後も次のジョブ開始までsnapshotを保つ", async () => {
  const { manager, calls, events } = controlled();
  const idle = manager.subscribe(() => {});
  assert.deepEqual(idle.replay, [{ type: "snapshot", revision: manager.revision, job: null }]);
  assert.equal(idle.live, false);

  const jobId = manager.start({ productCodes: ["RJ000001"] })!.job!.jobId;
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
  assert.deepEqual(events.at(-1), {
    type: "finished",
    revision: manager.revision,
    jobId,
    reason: "complete",
  });

  const after = manager.subscribe(() => {});
  assert.equal(after.live, false);
  const replayed = after.replay[0];
  assert.equal(replayed?.type === "snapshot" ? replayed.job?.status : null, "finished");

  const next = manager.start({ productCodes: ["RJ000002"] })!.job!.jobId;
  assert.notEqual(next, jobId);
  await manager.cancelActiveAndAwait();
});

test("打ち切りはキューを全破棄してfinished(aborted)を送り、ジョブを切り離す", async () => {
  const { manager, calls, events } = controlled(() => 1_700_000_000_000);
  const jobId = manager.start({ productCodes: ["RJ000001", "RJ000002"] })!.job!.jobId;
  manager.start({ productCodes: ["RJ000010"] });
  await tick();
  manager.subscribe((event) => events.push(event));
  const aborting = manager.cancelActiveAndAwait();
  assert.deepEqual(events, [
    { type: "finished", revision: manager.revision - 1, jobId, reason: "aborted" },
  ]);
  assert.equal(manager.getState().job, null);
  assert.equal(calls[0]!.signal?.aborted, true);
  await aborting;
  assert.equal(calls.length, 1);
  assert.deepEqual(events.length, 1);
});

test("打ち切り中のstartは新しいジョブで処理され、古いループは何も送出しない", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ productCodes: ["RJ000001"] });
  await tick();
  const aborting = manager.cancelActiveAndAwait();
  const jobId = manager.start({ productCodes: ["RJ000002"] })!.job!.jobId;
  manager.subscribe((event) => events.push(event));
  await aborting;
  await tick();
  assert.equal(calls.length, 2);
  assert.equal(calls[1]!.code, "RJ000002");
  calls[1]!.settle("fetched");
  await tick();
  assert.equal(manager.getState().job?.jobId, jobId);
  assert.equal(manager.getState().job?.status, "finished");
  assert.ok(events.every((event) => event.type !== "finished" || event.reason === "complete"));
});

test("取得の例外はそのコードのfailedになり、ジョブは続く", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  calls[0]!.fail(new Error("boom"));
  await tick();
  calls[1]!.settle("fetched");
  await tick();
  assert.deepEqual(states(manager), { RJ000001: "failed", RJ000002: "fetched" });
});

test("shutdownは実行中の取得を打ち切って完了を待ち、以降のstartを拒否する", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  await manager.shutdown();
  assert.equal(calls[0]!.signal?.aborted, true);
  assert.equal(calls.length, 1);
  assert.equal(manager.start({ productCodes: ["RJ000003"] }), null);
});

test("走行中の試行がすでにforceなら、force付きの要求が重なっても取り直しを立てない", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001"], force: true });
  await tick();
  manager.start({ productCodes: ["RJ000001"], force: true });
  calls[0]!.settle("fetched");
  await tick();
  assert.equal(calls.length, 1);
  assert.equal(manager.getState().job?.status, "finished");
});

function terminalRevisions(events: DlsiteJobEvent[]): number[] {
  return events.flatMap((event) => ("revision" in event ? [event.revision] : []));
}

test("送るイベントのrevisionは、ジョブをまたいでも真に増える", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  calls[0]!.settle("fetched");
  await tick();
  calls[1]!.settle("failed");
  await tick();
  manager.start({ productCodes: ["RJ000003"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  calls[2]!.settle("fetched");
  await tick();
  const revisions = terminalRevisions(events);
  assert.ok(revisions.length >= 6);
  for (let index = 1; index < revisions.length; index++) {
    assert.ok(revisions[index]! > revisions[index - 1]!);
  }
});

test("snapshotとstateのrevisionは、最後に送ったイベントと一致する", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ productCodes: ["RJ000001"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  calls[0]!.settle("fetched");
  await tick();
  const last = events.at(-1)!;
  assert.equal(manager.getState().revision, "revision" in last ? last.revision : -1);
  const replay = manager.subscribe(() => {}).replay[0]!;
  assert.equal(replay.type === "snapshot" ? replay.revision : -1, manager.getState().revision);
});

test("見た目の変わらない重ね掛けではrevisionを進めない", async () => {
  const { manager } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  manager.start({ productCodes: ["RJ000002"] });
  const before = manager.revision;
  manager.start({ productCodes: ["RJ000002"] });
  assert.equal(manager.revision, before);
  await manager.cancelActiveAndAwait();
});

test("見た目の変わらないforceの重ね掛けでは、待機中でも取得中でもrevisionを進めない", async () => {
  const { manager, calls } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  await tick();
  const before = manager.revision;
  manager.start({ productCodes: ["RJ000002"], force: true });
  assert.equal(manager.revision, before);
  manager.start({ productCodes: ["RJ000001"], force: true });
  assert.equal(manager.revision, before);
  assert.equal(calls.length, 1);
  await manager.cancelActiveAndAwait();
});

test("時計が止まっていてもrevisionは進み、新しいマネージャーの初期値は前の最後の値以上になる", async () => {
  let clock = 1_000;
  const first = controlled(() => clock);
  first.manager.start({ productCodes: ["RJ000001"] });
  await tick();
  first.calls[0]!.settle("fetched");
  await tick();
  const last = first.manager.revision;
  assert.ok(last > clock);
  clock = last + 5;
  const second = controlled(() => clock);
  assert.ok(second.manager.revision > last);
});

test("短時間に大量に進んでも、1ミリ秒後に作った新しいマネージャーの初期値は前の最後の値を超える", async () => {
  const clock = 1_700_000_000_000;
  const first = controlled(() => clock);
  first.manager.start({
    productCodes: Array.from({ length: 500 }, (_, index) => `RJ${String(100000 + index)}`),
  });
  const last = first.manager.revision;
  assert.ok(last > clock * 1000 + 400);
  assert.ok(last < Number.MAX_SAFE_INTEGER);
  const second = controlled(() => clock + 1);
  assert.ok(second.manager.revision > last);
  await first.manager.cancelActiveAndAwait();
});

test("終端イベントとsnapshotはコードごとのrevisionと取得結果を運ぶ", async () => {
  const { manager, calls, events } = controlled();
  manager.start({ productCodes: ["RJ000001", "RJ000002"] });
  manager.subscribe((event) => events.push(event));
  await tick();
  calls[0]!.settle("fetched");
  await tick();
  const terminal = events.find((event) => event.type === "code" && event.state === "fetched");
  assert.deepEqual(terminal && "dlsite" in terminal ? terminal.dlsite : null, {
    state: "fetched",
    title: "タイトル",
    cover: null,
  });
  const code = manager.getState().job!.codes.find((entry) => entry.productCode === "RJ000001")!;
  assert.equal(code.revision, terminal && "revision" in terminal ? terminal.revision : -1);
  assert.deepEqual("dlsite" in code ? code.dlsite : null, {
    state: "fetched",
    title: "タイトル",
    cover: null,
  });
  await manager.cancelActiveAndAwait();
});

test("打ち切りでジョブがnullになるとrevisionが進む（実行中・finished済みの両方）", async () => {
  const running = controlled();
  running.manager.start({ productCodes: ["RJ000001"] });
  await tick();
  const events: DlsiteJobEvent[] = [];
  running.manager.subscribe((event) => events.push(event));
  const aborting = running.manager.cancelActiveAndAwait();
  const finished = events.at(-1)!;
  assert.equal(finished.type, "finished");
  assert.ok(running.manager.getState().revision > ("revision" in finished ? finished.revision : 0));
  assert.equal(running.manager.getState().job, null);
  await aborting;

  const done = controlled();
  done.manager.start({ productCodes: ["RJ000001"] });
  await tick();
  done.calls[0]!.settle("fetched");
  await tick();
  const before = done.manager.revision;
  await done.manager.cancelActiveAndAwait();
  assert.ok(done.manager.revision > before);
  assert.equal(done.manager.getState().job, null);
});
