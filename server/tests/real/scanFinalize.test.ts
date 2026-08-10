import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { finalizeScan, LAST_SCAN_TIME_KEY } from "../../src/adapters/real/scanFinalize.ts";

test("finalizeScan: サムネイルGC後に last_scan_time を記録する", async (t) => {
  const thumbnailCacheDir = mkdtempSync(join(tmpdir(), "mimimilli-scan-finalize-"));
  t.after(() => rmSync(thumbnailCacheDir, { recursive: true, force: true }));

  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };
  const query = {
    listSummaries: () => ({
      summaries: [],
      skipped: [],
    }),
  };

  await finalizeScan({
    query,
    catalog,
    thumbnailCacheDir,
    integrityLogContext: "scan-finalize-test",
  });

  assert.ok(scanStates.has(LAST_SCAN_TIME_KEY));
  assert.ok(scanStates.get(LAST_SCAN_TIME_KEY));
});

test("finalizeScan: throwIfCancelled が呼ばれたら last_scan_time を記録しない", async (t) => {
  const thumbnailCacheDir = mkdtempSync(join(tmpdir(), "mimimilli-scan-finalize-abort-"));
  t.after(() => rmSync(thumbnailCacheDir, { recursive: true, force: true }));

  const scanStates = new Map<string, string | null>();
  const catalog = {
    setScanState: (key: string, value: string | null) => scanStates.set(key, value),
  };
  const query = {
    listSummaries: () => ({
      summaries: [],
      skipped: [],
    }),
  };

  await assert.rejects(
    () =>
      finalizeScan({
        query,
        catalog,
        thumbnailCacheDir,
        throwIfCancelled: () => {
          throw new Error("cancelled");
        },
      }),
    /cancelled/,
  );
  assert.equal(scanStates.size, 0);
});
