import assert from "node:assert/strict";
import { test } from "node:test";
import {
  enqueueDlsiteJob,
  resetDlsiteProgressStateForTest,
  startDlsiteJob,
  subscribeToDlsite,
} from "../src/routes/dlsiteProgress.ts";
import type { DataAdapter } from "../src/adapter.ts";

test("DLsiteジョブは進捗を購読者へ配信し、完了を再接続時にreplayする", () => {
  resetDlsiteProgressStateForTest();
  const received: string[] = [];
  const job = startDlsiteJob();
  const subscription = subscribeToDlsite((event) => received.push(event.type));
  job.emit({ type: "progress", processed: 1, total: 2, workId: "work-1" });
  job.emit({ type: "complete", result: { fetched: 1, failed: 1, skipped: 0 } });
  job.finish();
  subscription.unsubscribe();
  assert.deepEqual(received, ["progress", "complete"]);

  const replay = subscribeToDlsite(() => {});
  assert.deepEqual(replay.replay, [
    { type: "complete", result: { fetched: 1, failed: 1, skipped: 0 } },
  ]);
});

test("実行中に追加された自動取得をFIFOで後続実行する", async () => {
  resetDlsiteProgressStateForTest();
  const calls: Array<{ mode: string; workIds: string[] | undefined }> = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => (releaseFirst = resolve));
  const adapter = {
    async runDlsiteBulk(mode: string, workIds: string[] | undefined) {
      calls.push({ mode, workIds });
      if (calls.length === 1) await firstGate;
      return { fetched: 1, failed: 0, skipped: 0 };
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
