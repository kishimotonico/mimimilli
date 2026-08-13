import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function snapshotTree(root: string): string[] {
  const snapshot: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      snapshot.push(path);
      if (entry.isDirectory()) visit(join(directory, entry.name), path);
    }
  };
  visit(root, "");
  return snapshot.sort();
}

test("選択した候補だけを登録し、除外した候補は以後返さない", async (t) => {
  const directory = makeTestDirectory("scan-candidates");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const selected = join(root, "選択作品");
  const excluded = join(root, "除外作品");
  mkdirSync(selected, { recursive: true });
  mkdirSync(excluded, { recursive: true });
  writeWav(join(selected, "track.wav"), 1);
  writeWav(join(excluded, "track.wav"), 1);

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  t.after(() => adapter.close());
  await adapter.updateSettings({ rootFolder: root });
  const beforeScan = snapshotTree(root);
  const scanned = await adapter.scan();
  assert.deepEqual(
    scanned.candidates.map((candidate) => candidate.path).sort(),
    ["選択作品", "除外作品"].sort(),
  );
  assert.equal(existsSync(join(selected, "mimimilli.json")), false);
  assert.deepEqual(snapshotTree(root), beforeScan, "scanは候補フォルダーへ一切書き込まない");

  await adapter.excludeScanCandidates(["除外作品"]);
  assert.deepEqual(await adapter.listScanCandidates(), [
    {
      path: "選択作品",
      inferredTitle: "選択作品",
      audioFileCount: 1,
      audioBreakdown: [{ extension: "wav", count: 1 }],
      rjCode: null,
    },
  ]);

  const result = await adapter.registerScanCandidates([{ path: workspacePath("選択作品") }]);
  assert.equal(result.registered.length, 1);
  assert.deepEqual(result.failures, []);
  assert.equal(existsSync(join(selected, "mimimilli.json")), true);
  assert.equal(existsSync(join(excluded, "mimimilli.json")), false);
  await assert.rejects(
    () => adapter.registerScanCandidates([{ path: workspacePath("選択作品") }]),
    /候補が更新されています/,
  );
});

test("stale候補を含む一括登録は書込み前に全件拒否する", async (t) => {
  const directory = makeTestDirectory("scan-candidate-stale-preflight");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const current = join(root, "現在の候補");
  mkdirSync(current, { recursive: true });
  writeWav(join(current, "track.wav"), 1);
  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  t.after(() => adapter.close());
  await adapter.updateSettings({ rootFolder: root });

  await assert.rejects(
    () =>
      adapter.registerScanCandidates([
        { path: workspacePath("現在の候補") },
        { path: workspacePath("古い候補") },
      ]),
    /候補が更新されています/,
  );
  assert.equal(existsSync(join(current, "mimimilli.json")), false);
});

test("候補除外はuser DBを再オープンしても保持される", async (t) => {
  const directory = makeTestDirectory("scan-candidate-exclusion-persistence");
  t.after(directory.cleanup);
  const root = join(directory.path, "library");
  mkdirSync(join(root, "除外対象"), { recursive: true });
  writeWav(join(root, "除外対象", "track.wav"), 1);
  const database = {
    kind: "files" as const,
    catalogPath: join(directory.path, "data", "db", "catalog.sqlite"),
    userPath: join(directory.path, "data", "db", "user.sqlite"),
  };
  const options = {
    database,
    dataRoot: join(directory.path, "data"),
    thumbnailCacheDir: join(directory.path, "data", "cache", "thumbnails"),
  };
  const first = createTestRealAdapter(options);
  await first.updateSettings({ rootFolder: root });
  await first.scan();
  await first.excludeScanCandidates(["除外対象"]);
  first.close();

  const reopened = createTestRealAdapter(options);
  try {
    assert.deepEqual(await reopened.listScanCandidates(), []);
  } finally {
    reopened.close();
  }
});
