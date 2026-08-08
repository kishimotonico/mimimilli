import assert from "node:assert/strict";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createSettingsScanMethods } from "../../src/adapters/real/settingsScanMethods.ts";
import type { Scanner } from "../../src/adapters/real/scanner.ts";
import type { WorkRepo } from "../../src/adapters/real/workRepo.ts";

test("updateSettings は receiver なしで呼び出せる", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mimimilli-settings-methods-"));
  const settings = new Map<string, string>();
  const repo = {
    getUserSetting: (key: string) => settings.get(key) ?? null,
    getScanState: () => null,
    setUserSetting: (key: string, value: string) => settings.set(key, value),
    listSummaries: () => ({ summaries: [], skipped: [] }),
    setScanState: () => undefined,
  } satisfies Pick<
    WorkRepo,
    "getUserSetting" | "getScanState" | "setUserSetting" | "listSummaries" | "setScanState"
  >;

  try {
    const { updateSettings } = createSettingsScanMethods({
      database: { kind: "memory" },
      repo,
      scanner: undefined as unknown as Scanner,
      dataRoot: rootDir,
      thumbnailCacheDir: rootDir,
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
