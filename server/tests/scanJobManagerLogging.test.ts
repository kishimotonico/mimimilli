import assert from "node:assert/strict";
import { test } from "node:test";
import type { ScanResult } from "@mimimilli/shared";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import type { DataAdapter } from "../src/adapter/index.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";
import { captureLogs, scanRecords } from "./helpers/logCapture.ts";

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
  candidatePool: [],
};

function withStubAdapter(overrides: Partial<DataAdapter> & Pick<DataAdapter, "scan">): DataAdapter {
  const fixture = createFixtureAdapter();
  return {
    ...fixture,
    getSettings:
      overrides.getSettings ??
      (() => Promise.resolve({ rootFolder: "/music/library", lastScanTime: null })),
    ...overrides,
  };
}

async function waitForTerminal(manager: ScanJobManager, id: string): Promise<void> {
  for (let attempt = 0; attempt < 80; attempt++) {
    const snapshot = manager.get(id);
    if (snapshot?.finishedAt) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error("scan job did not finish");
}

function recordMessage(record: { message: readonly unknown[] }): string {
  return String(record.message[0] ?? "");
}

test("完了時に scan カテゴリの INFO 要約ログを1回記録する", async () => {
  const unreadablePaths = Array.from({ length: 12 }, (_, index) => `/blocked/${index}`);
  const result: ScanResult = {
    registered: 4,
    insertedWorkIds: ["RJ501011", "RJ501012"],
    updatedWorkIds: [],
    errors: 1,
    missing: 3,
    rjCodeMissingCount: 5,
    skipped: 6,
    coverErrors: 7,
    candidates: [],
    candidatePool: [],
    identityConflicts: [
      {
        kind: "identity_conflict",
        workId: "work-id",
        paths: ["copy-a/mimimilli.json", "copy-b/mimimilli.json"],
      },
    ],
    invalidMetaFiles: [],
    unreadablePaths,
    dataIntegrityWarning: { skippedCount: 1, skippedWorkIds: ["bad-work"] },
  };
  const adapter = withStubAdapter({
    scan: () => Promise.resolve(result),
  });

  await captureLogs(async (records) => {
    const manager = new ScanJobManager(adapter);
    const job = manager.start({ full: true });
    await waitForTerminal(manager, job.id);
    assert.equal(manager.get(job.id)?.status, "completed");

    const completed = scanRecords(records).filter(
      (record) => record.level === "info" && recordMessage(record) === "スキャンが完了しました",
    );
    assert.equal(completed.length, 1);
    const properties = completed[0]!.properties;
    assert.equal(properties.jobId, job.id);
    assert.equal(typeof properties.durationMs, "number");
    assert.equal(properties.registered, 4);
    assert.equal(properties.insertedWorkIdsCount, 2);
    assert.equal(properties.updatedWorkIdsCount, 0);
    assert.equal(properties.errors, 1);
    assert.equal(properties.missing, 3);
    assert.equal(properties.skipped, 6);
    assert.equal(properties.coverErrors, 7);
    assert.equal(properties.rjCodeMissingCount, 5);
    assert.equal(properties.identityConflictsCount, 1);
    assert.equal(properties.unreadablePathsCount, 12);
    assert.deepEqual(properties.unreadablePathsSample, unreadablePaths.slice(0, 10));
    assert.equal(properties.dataIntegrityWarning, true);
    assert.equal("insertedWorkIds" in properties, false);
  });
});

test("取消時に jobId と durationMs を INFO で1回記録する", async () => {
  let finishScan!: () => void;
  const scanDone = new Promise<ScanResult>((resolve) => {
    finishScan = () => resolve(emptyResult);
  });
  const adapter = withStubAdapter({
    scan: () => scanDone,
  });

  await captureLogs(async (records) => {
    const manager = new ScanJobManager(adapter);
    const job = manager.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    manager.cancel(job.id);
    finishScan();
    await waitForTerminal(manager, job.id);
    assert.equal(manager.get(job.id)?.status, "cancelled");

    const cancelled = scanRecords(records).filter(
      (record) => record.level === "info" && recordMessage(record) === "スキャンを取り消しました",
    );
    assert.equal(cancelled.length, 1);
    assert.equal(cancelled[0]!.properties.jobId, job.id);
    assert.equal(typeof cancelled[0]!.properties.durationMs, "number");
  });
});

test("失敗時に元の Error の errorKind と stack を ERROR で1回記録する", async () => {
  const originalError = new Error("fixture scan failed");
  originalError.name = "FixtureScanError";
  const adapter = withStubAdapter({
    scan: () => Promise.reject(originalError),
  });

  await captureLogs(async (records) => {
    const manager = new ScanJobManager(adapter);
    const job = manager.start();
    await waitForTerminal(manager, job.id);
    const snapshot = manager.get(job.id);
    assert.equal(snapshot?.status, "failed");
    assert.equal(snapshot?.error, "fixture scan failed");

    const failed = scanRecords(records).filter(
      (record) => record.level === "error" && recordMessage(record) === "スキャンに失敗しました",
    );
    assert.equal(failed.length, 1);
    const properties = failed[0]!.properties;
    assert.equal(properties.jobId, job.id);
    assert.equal(typeof properties.durationMs, "number");
    assert.equal(properties.errorKind, "FixtureScanError");
    assert.equal(properties.message, "fixture scan failed");
    assert.equal(properties.stack, originalError.stack);
  });
});

test("getSettings の await 中に取消すると scan を呼ばず cancelled ログを記録する", async () => {
  let resolveSettings!: () => void;
  const settingsReady = new Promise<void>((resolve) => {
    resolveSettings = resolve;
  });
  let scanCalled = false;
  const adapter = withStubAdapter({
    getSettings: async () => {
      await settingsReady;
      return { rootFolder: "/music/library", lastScanTime: null };
    },
    scan: async () => {
      scanCalled = true;
      return emptyResult;
    },
  });

  await captureLogs(async (records) => {
    const manager = new ScanJobManager(adapter);
    const job = manager.start();
    await new Promise((resolve) => setTimeout(resolve, 0));
    manager.cancel(job.id);
    resolveSettings();
    await waitForTerminal(manager, job.id);

    assert.equal(scanCalled, false);
    assert.equal(manager.get(job.id)?.status, "cancelled");

    const cancelled = scanRecords(records).filter(
      (record) => record.level === "info" && recordMessage(record) === "スキャンを取り消しました",
    );
    assert.equal(cancelled.length, 1);
    assert.equal(cancelled[0]!.properties.jobId, job.id);
  });
});
