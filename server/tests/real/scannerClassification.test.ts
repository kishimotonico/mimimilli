import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary, makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

test("スキャン分類: 初回は新規挿入、変更なし再スキャンはスキップ、メタ更新は再投影", async (t) => {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: lib.root });

  const first = await adapter.scan();
  assert.deepEqual(first.insertedWorkIds, [lib.existingWorkId]);
  assert.deepEqual(first.updatedWorkIds, []);
  assert.equal(first.skipped, 0);
  assert.ok(first.candidates.length > 0);
  assert.equal(first.candidates[0]?.rjCode, "RJ900001");

  const second = await adapter.scan();
  assert.deepEqual(second.insertedWorkIds, []);
  assert.deepEqual(second.updatedWorkIds, [lib.existingWorkId]);
  assert.equal(second.skipped, 0);

  const metaPath = join(lib.root, "dlsite", "RJ900002_既存メタ", "mimimilli.json");
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.title = "外部編集後のタイトル";
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const third = await adapter.scan();
  assert.deepEqual(third.insertedWorkIds, []);
  assert.deepEqual(third.updatedWorkIds, [lib.existingWorkId]);
});

test("候補登録: RJコード省略時はフォルダー名から自動検出する", async (t) => {
  const directory = makeTestDirectory("scan-candidate-rj-auto");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_自動検出作品");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const registered = await adapter.registerScanCandidates([
    { path: workspacePath("RJ123456_自動検出作品") },
  ]);
  assert.equal(registered.registered.length, 1);

  const meta = JSON.parse(readFileSync(join(workDir, "mimimilli.json"), "utf-8"));
  assert.equal(meta.dlsite.rjCode, "RJ123456");
});

test("候補登録: RJコード指定をmimimilli.jsonへ書き込む", async (t) => {
  const directory = makeTestDirectory("scan-candidate-rj-code");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_指定作品");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const registered = await adapter.registerScanCandidates([
    { path: workspacePath("RJ123456_指定作品"), rjCode: "RJ999999" },
  ]);
  assert.equal(registered.registered.length, 1);

  const meta = JSON.parse(readFileSync(join(workDir, "mimimilli.json"), "utf-8"));
  assert.equal(meta.dlsite.rjCode, "RJ999999");
});

test("候補登録: RJコード空文字は自動検出せずRJコードなしで書き込む", async (t) => {
  const directory = makeTestDirectory("scan-candidate-rj-empty");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "RJ123456_誤検出を消す作品");
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  const scanned = await adapter.scan();
  assert.equal(scanned.candidates[0]?.rjCode, "RJ123456");

  const registered = await adapter.registerScanCandidates([
    { path: workspacePath("RJ123456_誤検出を消す作品"), rjCode: "" },
  ]);
  assert.equal(registered.registered.length, 1);

  const meta = JSON.parse(readFileSync(join(workDir, "mimimilli.json"), "utf-8"));
  assert.notEqual(meta.dlsite.rjCode, "RJ123456");
  assert.ok(meta.dlsite.rjCode === null || meta.dlsite.rjCode === "");
});

test("候補除外の一覧取得と解除で次回スキャンに候補が戻る", async (t) => {
  const directory = makeTestDirectory("scan-candidate-exclusion-restore");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(join(root, "除外対象"), { recursive: true });
  writeWav(join(root, "除外対象", "track.wav"), 1);

  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();
  await adapter.excludeScanCandidates(["除外対象"]);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), ["除外対象"]);
  assert.deepEqual(await adapter.listScanCandidates(), []);

  await adapter.restoreScanCandidateExclusions(["除外対象"]);
  assert.deepEqual(await adapter.listScanCandidateExclusions(), []);
  assert.deepEqual(
    (await adapter.listScanCandidates()).map((candidate) => candidate.path),
    ["除外対象"],
  );
});
