// スキャン完了で新規作品があるとDLsite一括取得ジョブが1件積まれる（TASK-428.4）。
// scanJobManagerはDlsiteJobManagerを直接知らず、コンストラクタへ渡した完了コールバック経由で通知する。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScanResult } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import type { DataAdapter } from "../src/adapter/index.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";

const emptyResult: ScanResult = {
  registered: 0,
  insertedWorkIds: [],
  updatedWorkIds: [],
  errors: 0,
  missing: 0,
  rjCodeMissingCount: 0,
  skipped: 0,
  coverErrors: 0,
  identityConflicts: [],
  invalidMetaFiles: [],
  candidates: [],
};

function withStubAdapter(overrides: Partial<DataAdapter> & Pick<DataAdapter, "scan">): DataAdapter {
  const fixture = createFixtureAdapter();
  return {
    ...fixture,
    getSettings:
      overrides.getSettings ??
      (() =>
        Promise.resolve({
          rootFolder: "/music/library",
          lastScanTime: null,
          lastScanRootFolder: null,
        })),
    ...overrides,
  };
}

async function waitForTerminal(manager: ScanJobManager, id: string): Promise<void> {
  if (manager.get(id)?.finishedAt) return;
  await new Promise<void>((resolve, reject) => {
    const sub = manager.subscribe(id, null, (event) => {
      if (event.type === "completed" || event.type === "failed" || event.type === "cancelled") {
        sub?.unsubscribe();
        resolve();
      }
    });
    if (!sub) {
      reject(new Error(`scan job not found: ${id}`));
      return;
    }
    if (sub.snapshot.finishedAt) {
      sub.unsubscribe();
      resolve();
    }
  });
}

test("完了時にinsertedWorkIdsが1件以上あれば完了コールバックへ渡す", async () => {
  const result: ScanResult = { ...emptyResult, insertedWorkIds: ["work-1", "work-2"] };
  const adapter = withStubAdapter({ scan: () => Promise.resolve(result) });
  const calls: string[][] = [];
  const manager = new ScanJobManager(adapter, undefined, undefined, (insertedWorkIds) => {
    calls.push(insertedWorkIds);
  });

  const job = manager.start();
  await waitForTerminal(manager, job.id);

  assert.equal(manager.get(job.id)?.status, "completed");
  assert.deepEqual(calls, [["work-1", "work-2"]]);
});

test("完了時にinsertedWorkIdsが空なら完了コールバックを呼ばない", async () => {
  const adapter = withStubAdapter({ scan: () => Promise.resolve(emptyResult) });
  const calls: string[][] = [];
  const manager = new ScanJobManager(adapter, undefined, undefined, (insertedWorkIds) => {
    calls.push(insertedWorkIds);
  });

  const job = manager.start();
  await waitForTerminal(manager, job.id);

  assert.equal(manager.get(job.id)?.status, "completed");
  assert.deepEqual(calls, []);
});

test("中止時は完了コールバックを呼ばない", async () => {
  let finishScan!: () => void;
  const scanDone = new Promise<ScanResult>((resolve) => {
    finishScan = () => resolve({ ...emptyResult, insertedWorkIds: ["work-1"] });
  });
  const adapter = withStubAdapter({ scan: () => scanDone });
  const calls: string[][] = [];
  const manager = new ScanJobManager(adapter, undefined, undefined, (insertedWorkIds) => {
    calls.push(insertedWorkIds);
  });

  const job = manager.start();
  await new Promise((resolve) => setTimeout(resolve, 0));
  manager.cancel(job.id);
  finishScan();
  await waitForTerminal(manager, job.id);

  assert.equal(manager.get(job.id)?.status, "cancelled");
  assert.deepEqual(calls, []);
});

test("失敗時は完了コールバックを呼ばない", async () => {
  const adapter = withStubAdapter({ scan: () => Promise.reject(new Error("boom")) });
  const calls: string[][] = [];
  const manager = new ScanJobManager(adapter, undefined, undefined, (insertedWorkIds) => {
    calls.push(insertedWorkIds);
  });

  const job = manager.start();
  await waitForTerminal(manager, job.id);

  assert.equal(manager.get(job.id)?.status, "failed");
  assert.deepEqual(calls, []);
});
