// スキャン結果が持つ、記録の元になる事実（開始時の空判定・新たな行方不明）の検証。
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { workspacePath } from "@mimimilli/shared";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import {
  createWorkRepos,
  getTestWork,
  makeWork,
  upsertTestWork,
} from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { runScan } from "../helpers/scanLibrary.ts";

function writeWork(root: string, folder: string, id: string, title: string): string {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeWav(join(dir, "track.wav"), 1);
  writeFileSync(
    join(dir, "mimimilli.json"),
    JSON.stringify({
      formatVersion: 1,
      id,
      title,
      playlists: [
        {
          id: crypto.randomUUID(),
          name: "default",
          tracks: [{ id: crypto.randomUUID(), title: "track", file: "track.wav" }],
        },
      ],
      defaultPlaylistId: null,
    }),
  );
  return dir;
}

const ID_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

test("catalogが空で始まったスキャンだけ startedWithEmptyCatalog になり、insertedWorkIds は常に新規挿入を積む", async (t) => {
  const directory = makeTestDirectory("scan-record-facts-empty");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "a", ID_A, "A");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);

  const first = await runScan(adapter);
  assert.equal(first.startedWithEmptyCatalog, true);
  assert.deepEqual(first.insertedWorkIds, [ID_A]);

  writeWork(root, "b", ID_B, "B");
  const second = await runScan(adapter);
  assert.equal(second.startedWithEmptyCatalog, false);
  assert.deepEqual(second.insertedWorkIds, [ID_B]);
});

test("診断の行方不明は、状態がmissingの作品すべてで、旧パスとタイトルを持つ", async (t) => {
  const directory = makeTestDirectory("scan-record-facts-missing");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "sub/a", ID_A, "作品A");
  writeWork(root, "b", ID_B, "作品B");
  writeWork(root, "c", ID_C, "作品C");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  await runScan(adapter);
  assert.deepEqual((await adapter.listScanDiagnostics()).missingWorks, []);

  rmSync(join(root, "sub/a"), { recursive: true });
  const second = await runScan(adapter);
  assert.deepEqual((await adapter.listScanDiagnostics()).missingWorks, [
    { workId: ID_A, title: "作品A", previousPath: workspacePath("sub/a") },
  ]);
  assert.equal(second.missing, 1);

  rmSync(join(root, "b"), { recursive: true });
  const third = await runScan(adapter);
  assert.deepEqual(
    (await adapter.listScanDiagnostics()).missingWorks.map((work) => work.workId),
    [ID_A, ID_B],
  );
  assert.equal(third.missing, 2);

  await runScan(adapter);
  assert.equal((await adapter.listScanDiagnostics()).missingWorks.length, 2);
});

test("スキャン中に登録された作品は missing にならず、診断の行方不明にも入らない", async (t) => {
  const directory = makeTestDirectory("scan-record-facts-mid-scan");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "a", ID_A, "A");
  const db = directory.own(openDb({ kind: "memory" }));
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  await scanner.scan(root);

  const registeredDuringScan = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const { result } = await scanner.scan(root, undefined, {
    beforeFinalize: () =>
      upsertTestWork(repos.catalog, repos.user, makeWork({ id: registeredDuringScan })),
  });

  assert.equal((await getTestWork(db, registeredDuringScan))?.status, "ok");
  assert.deepEqual(repos.query.listMissingWorks(root), []);
  assert.equal(result.missing, 0);
});

const CHAIN_LENGTH = 130;

/**
 * 1ディレクトリずつ辿る鎖を作り、鎖の `depth` 番目のフォルダーを50個目のdirを辿った時点で登録する。
 * 浅い depth は走査が通過済み、深い depth は未通過のフォルダーを登録することになる。
 */
async function scanRegisteringAtDepth(t: TestContext, depth: number) {
  const directory = makeTestDirectory("scan-register-during-walk");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const segments = Array.from({ length: CHAIN_LENGTH }, (_, index) => `c${index}`);
  mkdirSync(join(root, ...segments), { recursive: true });
  const target = segments.slice(0, depth);
  writeWav(join(root, ...target, "track.wav"), 1);
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);

  let registration: Promise<string> | null = null;
  let registeredBeforeScanEnd = false;
  const result = await runScan(adapter, {
    onProgress: (event) => {
      if (event.type !== "progress" || event.phase !== "walking" || event.processed !== 50) return;
      registration = (async () => {
        const created = await adapter.createWork({
          path: workspacePath(target.join("/")),
          title: "走査中に登録",
          tags: [],
          rjCode: "",
          applyCover: false,
          applyUrl: false,
        });
        const workId = created!.snapshot.id;
        await adapter.patchWorkBookmark(workId, { bookmarked: true });
        registeredBeforeScanEnd = true;
        return workId;
      })();
    },
  });
  assert.ok(registration, "走査中に登録が始まっている");
  const workId = await registration;
  assert.equal(registeredBeforeScanEnd, true, "登録は走査の終了前に完了している");
  return { adapter, result, workId };
}

test("走査が通過した後のフォルダーに走査中に登録した作品は、行方不明にならず、開始時の空判定も崩れない", async (t) => {
  const { adapter, result, workId } = await scanRegisteringAtDepth(t, 1);
  assert.equal(result.missing, 0);
  assert.deepEqual((await adapter.listScanDiagnostics()).missingWorks, []);
  assert.equal(result.startedWithEmptyCatalog, true);
  const work = await adapter.getWork(workId);
  assert.equal(work?.status, "ok");
  assert.equal(work?.bookmarked, true);
});

test("走査がまだ通過していないフォルダーに走査中に登録した作品は、重複行・競合・状態の初期化を起こさない", async (t) => {
  const { adapter, result, workId } = await scanRegisteringAtDepth(t, CHAIN_LENGTH - 2);
  assert.deepEqual((await adapter.listScanDiagnostics()).missingWorks, []);
  assert.deepEqual((await adapter.listScanDiagnostics()).identityConflicts, []);
  const work = await adapter.getWork(workId);
  assert.equal(work?.status, "ok");
  assert.equal(work?.bookmarked, true);
  assert.equal(result.insertedWorkIds.filter((id) => id === workId).length <= 1, true);
  assert.deepEqual((await runScan(adapter)).insertedWorkIds, []);
});
