import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSettingsScanMethods } from "../../src/adapters/real/settingsScanMethods.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DEFAULT_DLSITE_CACHE_TTLS_MS,
} from "../../src/adapters/real/dlsiteCache.ts";
import type { Scanner } from "../../src/adapters/real/scanner.ts";

test("updateSettings は receiver なしで呼び出せる", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mimimilli-settings-methods-"));
  const settings = new Map<string, string>();
  const user = {
    getUserSetting: (key: string) => settings.get(key) ?? null,
    setUserSetting: (key: string, value: string) => settings.set(key, value),
    listScanCandidateExclusions: () => [],
    excludeScanCandidates: () => undefined,
    restoreScanCandidateExclusions: () => undefined,
  };
  const catalog = {
    getScanState: () => null,
    setScanState: () => undefined,
    listIdentityConflicts: () => [],
  };
  const query = {
    listSummaries: () => ({ summaries: [], skipped: [] }),
  };

  try {
    const { updateSettings } = createSettingsScanMethods({
      database: { kind: "memory" },
      query,
      catalog,
      user,
      scanner: undefined as unknown as Scanner,
      thumbnailCacheDir: rootDir,
      dlsiteCache: {
        path: ":memory:",
        ttlsMs: DEFAULT_DLSITE_CACHE_TTLS_MS,
        maxTransferBytes: DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
        maxExpandedBytes: DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
      },
      runFileScanInWorker: async () => {
        throw new Error("scan はこのテストで呼び出されません");
      },
    });

    const expectedRoot = realpathSync(rootDir);
    assert.deepEqual(await updateSettings({ rootFolder: rootDir }), {
      rootFolder: expectedRoot,
      lastScanTime: null,
    });
    assert.equal(settings.get("root_folder"), expectedRoot);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});
