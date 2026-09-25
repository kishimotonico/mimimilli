import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { InvalidRootFolderError } from "../../src/errors.ts";
import { createSettingsScanMethods } from "../../src/adapters/real/settingsScanMethods.ts";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DEFAULT_DLSITE_CACHE_TTLS_MS,
} from "../../src/adapters/real/dlsiteCache.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { UserWorkStateRepository } from "../../src/adapters/real/userWorkStateRepository.ts";
import type { Scanner } from "../../src/adapters/real/scanner.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";

test("resolveRootFolder / beginRootReconfiguration は receiver なしで呼び出せる", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "mimimilli-settings-methods-"));
  const settings = new Map<string, string>();
  const user = {
    getUserSetting: (key: string) => settings.get(key) ?? null,
    setUserSetting: (key: string, value: string) => settings.set(key, value),
    deleteUserSetting: (key: string) => settings.delete(key),
    listScanCandidateExclusions: () => [],
    excludeScanCandidates: () => undefined,
    restoreScanCandidateExclusions: () => undefined,
    setUserSettings: (values: Record<string, string>) => {
      for (const [key, value] of Object.entries(values)) settings.set(key, value);
    },
  };
  const catalog = {
    getScanState: () => null,
    setScanState: () => undefined,
    listIdentityConflicts: () => [],
    deleteWorksOutsideRoot: () => 0,
  };
  const query = {
    listSummaries: () => ({ summaries: [], skipped: [], unmeasuredCovers: [] }),
  };

  try {
    const {
      resolveRootFolder,
      beginRootReconfiguration,
      completeRootReconfiguration,
      getSettings,
    } = createSettingsScanMethods({
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
    await beginRootReconfiguration(await resolveRootFolder(rootDir));
    await completeRootReconfiguration();
    assert.deepEqual(await getSettings(), {
      rootFolder: expectedRoot,
      lastScanTime: null,
      lastScanRootFolder: null,
    });
    assert.equal(settings.get("root_folder"), expectedRoot);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
});

test("同一rootの再保存（正規化後一致）では候補除外を破棄しない", async (t) => {
  const directory = makeTestDirectory("settings-same-root-keep-exclusions");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const target = join(root, "候補");
  mkdirSync(target, { recursive: true });
  writeWav(join(target, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  await adapter.excludeScanCandidates(["候補"]);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["候補"]);

  // 同じパスを再度そのまま保存する（realpath正規化後は同一root）。
  await configureRoot(adapter, root);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["候補"]);
});

test("異なるrootへの変更で候補除外とScanCandidateSessionを破棄する", async (t) => {
  const directory = makeTestDirectory("settings-root-change-discards-exclusions");
  t.after(directory.cleanup);
  const rootA = join(directory.path, "lib-a");
  const rootB = join(directory.path, "lib-b");
  const targetA = join(rootA, "候補A");
  const targetB = join(rootB, "候補B");
  mkdirSync(targetA, { recursive: true });
  mkdirSync(targetB, { recursive: true });
  writeWav(join(targetA, "track.wav"), 1);
  writeWav(join(targetB, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, rootA);
  await adapter.scan();
  await adapter.excludeScanCandidates(["候補A"]);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["候補A"]);
  assert.deepEqual(
    (await adapter.listScanCandidates()).map((c) => c.path),
    [],
  );

  await configureRoot(adapter, rootB);

  assert.deepEqual(await adapter.listScanCandidateExclusions(), []);
  // rootA走査時のScanCandidateSessionも破棄され、rootBの再スキャン前は候補を返さない。
  assert.deepEqual(await adapter.listScanCandidates(), []);
});

test("失敗したroot変更では候補除外を破棄しない", async (t) => {
  const directory = makeTestDirectory("settings-failed-root-change-keeps-exclusions");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const target = join(root, "候補");
  mkdirSync(target, { recursive: true });
  writeWav(join(target, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await adapter.scan();
  await adapter.excludeScanCandidates(["候補"]);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["候補"]);

  await assert.rejects(
    () => adapter.resolveRootFolder(join(directory.path, "存在しない")),
    InvalidRootFolderError,
  );

  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["候補"]);
});

test("setUserSettingsは途中で失敗すると除外の削除もroot保存もロールバックする", () => {
  const db = openDb({ kind: "memory" });
  try {
    const repo = new UserWorkStateRepository(db);
    repo.excludeScanCandidates(["候補"]);
    assert.deepEqual(repo.listScanCandidateExclusions(), ["候補"]);

    assert.throws(() => {
      repo.setUserSettings(
        // objectはtext列にbindできずbun:sqliteが例外を投げる。除外の削除は
        // 同じトランザクション内なのでロールバックされるはず。
        { root_folder: {} as unknown as string },
        { discardScanCandidateExclusions: true },
      );
    });

    assert.deepEqual(repo.listScanCandidateExclusions(), ["候補"]);
    assert.equal(repo.getUserSetting("root_folder"), null);
  } finally {
    db.close();
  }
});
