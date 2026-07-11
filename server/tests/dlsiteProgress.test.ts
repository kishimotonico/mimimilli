import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resetDlsiteProgressStateForTest,
  startDlsiteJob,
  subscribeToDlsite,
} from "../src/routes/dlsiteProgress.ts";

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
