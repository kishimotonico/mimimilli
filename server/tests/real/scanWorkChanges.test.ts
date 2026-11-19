import assert from "node:assert/strict";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeSampleLibrary, writeWav } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";

async function scannedLibrary(t: import("node:test").TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, lib.root);
  await adapter.scan();
  const workDir = join(lib.root, "dlsite", "RJ900002_既存メタ");
  return { lib, adapter, workDir, metaPath: join(workDir, "mimimilli.json") };
}

async function healthyLibrary(t: import("node:test").TestContext) {
  const scanned = await scannedLibrary(t);
  writeWav(join(scanned.workDir, "missing.wav"), 1);
  const recovered = await scanned.adapter.scan();
  assert.deepEqual(recovered.updatedWorks, []);
  return scanned;
}

test("変化の種類: エラー状態の再読み込みと全件読み直しは変化に入れない", async (t) => {
  const { adapter } = await scannedLibrary(t);

  const incremental = await adapter.scan();
  assert.deepEqual(incremental.updatedWorks, []);

  const full = await adapter.scan({ full: true });
  assert.deepEqual(full.updatedWorks, []);
});

test("変化の種類: フォルダー移動は旧パスと新パスを持つ", async (t) => {
  const { lib, adapter, workDir } = await healthyLibrary(t);
  mkdirSync(join(lib.root, "moved"), { recursive: true });
  renameSync(workDir, join(lib.root, "moved", "RJ900002_既存メタ"));

  const result = await adapter.scan();
  assert.deepEqual(result.updatedWorks, [
    {
      workId: lib.existingWorkId,
      changes: [
        {
          kind: "moved",
          from: workspacePath("dlsite/RJ900002_既存メタ"),
          to: workspacePath("moved/RJ900002_既存メタ"),
        },
      ],
    },
  ]);
});

test("変化の種類: エラーからの復帰はファイルが復活しても変化に入れない", async (t) => {
  const { adapter, workDir } = await scannedLibrary(t);
  writeWav(join(workDir, "missing.wav"), 1);

  const result = await adapter.scan();
  assert.deepEqual(result.updatedWorks, []);
});

async function errorSingleAudioWork(t: import("node:test").TestContext) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  const adapter = lib.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, lib.root);
  const dir = join(lib.root, "single");
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, "single.mimimilli.json"),
    JSON.stringify({
      formatVersion: 1,
      id: "33333333-3333-4333-8333-333333333333",
      title: "single",
      playlists: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "default",
          tracks: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", title: "t", file: "single.wav" }],
        },
      ],
      defaultPlaylistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    }),
  );
  await adapter.scan();
  return { lib, adapter, dir };
}

test("変化の種類: 単体音声作品のエラーからの復帰は移動に見えない", async (t) => {
  const { adapter, dir } = await errorSingleAudioWork(t);
  writeWav(join(dir, "single.wav"), 1);

  const recovered = await adapter.scan();
  assert.deepEqual(recovered.updatedWorks, []);
});

test("変化の種類: エラーから行方不明を経て同じ場所に戻っても移動に見えない", async (t) => {
  const { lib, adapter, dir } = await errorSingleAudioWork(t);
  const away = join(lib.baseDir, "away");
  renameSync(dir, away);
  await adapter.scan();
  renameSync(away, dir);
  writeWav(join(dir, "single.wav"), 1);

  const back = await adapter.scan();
  const kinds = back.updatedWorks.flatMap((work) => work.changes.map((change) => change.kind));
  assert.deepEqual(kinds, ["files"]);
});

test("変化の種類: エラーから行方不明を経て別の場所で見つかると移動", async (t) => {
  const { lib, adapter, dir } = await errorSingleAudioWork(t);
  const away = join(lib.baseDir, "away");
  renameSync(dir, away);
  await adapter.scan();
  const elsewhere = join(lib.root, "elsewhere");
  renameSync(away, elsewhere);
  writeWav(join(elsewhere, "single.wav"), 1);

  const found = await adapter.scan();
  assert.equal(found.updatedWorks.length, 1);
  const [change] = found.updatedWorks[0]!.changes;
  assert.equal(change?.kind, "moved");
  assert.equal(change?.kind === "moved" && change.to, workspacePath("elsewhere/single.wav"));
});

test("変化の種類: トラック追加は作品情報とファイル構成の複合", async (t) => {
  const { lib, adapter, workDir, metaPath } = await healthyLibrary(t);
  writeWav(join(workDir, "extra.wav"), 1);
  const meta = JSON.parse(readFileSync(metaPath, "utf-8"));
  meta.playlists[0].tracks.push({
    id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    title: "追加",
    file: "extra.wav",
  });
  writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  const result = await adapter.scan();
  assert.deepEqual(result.updatedWorks, [
    {
      workId: lib.existingWorkId,
      changes: [{ kind: "meta" }, { kind: "files", audioDelta: 1 }],
    },
  ]);
});
