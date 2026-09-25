// RootReconfigurationWorkflow が受理済みリクエストのdrainを待ってから
// ジョブ取消・catalog再構築へ進むことを確認する（Codex指摘、ADR-0029手順2・3の間）。
import assert from "node:assert/strict";
import { test } from "node:test";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { DlsiteJobManager } from "../src/dlsiteJobManager.ts";
import { RootReconfigurationWorkflow } from "../src/rootReconfiguration.ts";
import { ScanJobManager } from "../src/scanJobManager.ts";

test("受理済みリクエストのdrainが終わるまでジョブ取消・catalog再構築を始めない", async () => {
  const adapter = createFixtureAdapter({ rootRebuildStepMs: 1 });
  const dlsiteJobs = new DlsiteJobManager(adapter);
  const scanJobs = new ScanJobManager(adapter, undefined, undefined, (insertedWorkIds) =>
    dlsiteJobs.enqueue("new", insertedWorkIds),
  );

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
