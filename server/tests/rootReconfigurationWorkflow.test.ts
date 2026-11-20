// RootReconfigurationWorkflow が受理済みリクエストのdrainを待ってから
// ジョブ取消・catalog再構築へ進むことを確認する（Codex指摘、ADR-0029手順2・3の間）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import { RootReconfigurationWorkflow } from "../src/rootReconfiguration.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";
import { scanExecutionOf } from "./helpers/scanLibrary.ts";

test("受理済みリクエストのdrainが終わるまでジョブ取消・catalog再構築を始めない", async () => {
  const adapter = createFixtureAdapter({ rootRebuildStepMs: 1 });
  const dlsiteJobs = new DlsiteJobManager(adapter);
  const scanJobs = new ScanJobManager(adapter);

  const order: string[] = [];
  let releaseDrain: (() => void) | undefined;
  const drain = () =>
    new Promise<void>((resolve) => {
      order.push("drain-start");
      releaseDrain = () => {
        order.push("drain-end");
        resolve();
      };
    });

  const originalCancelScan = scanJobs.cancelActiveAndAwait.bind(scanJobs);
  scanJobs.cancelActiveAndAwait = async () => {
    order.push("scan-cancel");
    return originalCancelScan();
  };

  const workflow = new RootReconfigurationWorkflow(adapter, scanJobs, dlsiteJobs, drain);

  const startPromise = workflow.start("/library");
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(order, ["drain-start"]);

  releaseDrain?.();
  await startPromise;
  assert.deepEqual(order, ["drain-start", "drain-end", "scan-cancel"]);
});

test("root再設定の開始は、DLsite取得ジョブのキューを起点を問わずすべて捨てる", async () => {
  const adapter = createFixtureAdapter({ rootRebuildStepMs: 1 });
  const dlsiteJobs = new DlsiteJobManager({
    fetchDlsiteProduct: (_code, options) =>
      new Promise((_resolve, reject) => {
        options.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("aborted", "AbortError")),
          { once: true },
        );
      }),
  });
  const scanJobs = new ScanJobManager(adapter);
  dlsiteJobs.start({ origin: "bulk", productCodes: ["RJ000001", "RJ000002"] });
  await new Promise((resolve) => setImmediate(resolve));
  dlsiteJobs.start({ origin: "single", productCode: "RJ000010" });
  assert.equal(dlsiteJobs.getState().job?.codes.length, 3);

  const workflow = new RootReconfigurationWorkflow(adapter, scanJobs, dlsiteJobs, async () => {});
  await workflow.start("/library");
  assert.equal(dlsiteJobs.getState().job, null);
  await workflow.shutdown();
});

test("root再設定の開始でスキャンの記録を空にし、構築の完了で構築結果の記録に置き換わる（開始時にcatalogが空なら新規作品は空）", async () => {
  const adapter = createFixtureAdapter({ scenario: "new-work", rootRebuildStepMs: 200 });
  const scanJobs = new ScanJobManager(adapter);
  const dlsiteJobs = new DlsiteJobManager(adapter);
  scanJobs.session.record.addNewWorks(["stale"]);
  scanJobs.session.record.replace(
    {
      registered: 0,
      insertedWorkIds: ["stale"],
      startedWithEmptyCatalog: false,
      updatedWorks: [{ workId: "stale", changes: [{ kind: "meta" }] }],
      errors: 0,
      missing: 0,
      skipped: 0,
      coverErrors: 0,
      unreadablePaths: [],
    },
    "2026-01-01T00:00:00.000Z",
  );

  const workflow = new RootReconfigurationWorkflow(adapter, scanJobs, dlsiteJobs, async () => {});
  await workflow.start("/library/dlsite/夜想曲スタジオ");
  assert.equal((await scanJobs.session.recordSnapshot()).finishedAt, null);
  await workflow.shutdown();

  scanJobs.session.publish(
    scanExecutionOf({
      registered: 1,
      insertedWorkIds: ["all-new-on-first-build"],
      startedWithEmptyCatalog: true,
      updatedWorks: [],
      errors: 0,
      missing: 0,
      skipped: 0,
      coverErrors: 0,
      unreadablePaths: [],
    }),
    new Date().toISOString(),
  );
  assert.deepEqual(scanJobs.session.record.workIds("new"), []);
  assert.equal(typeof (await scanJobs.session.recordSnapshot()).finishedAt, "string");
});
