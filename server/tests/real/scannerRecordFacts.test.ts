// スキャン結果が持つ、記録の元になる事実（開始時の空判定・新たな行方不明）の検証。
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
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

  const first = await adapter.scan();
  assert.equal(first.startedWithEmptyCatalog, true);
  assert.deepEqual(first.insertedWorkIds, [ID_A]);

  writeWork(root, "b", ID_B, "B");
  const second = await adapter.scan();
  assert.equal(second.startedWithEmptyCatalog, false);
  assert.deepEqual(second.insertedWorkIds, [ID_B]);
});

test("missingWorks は今回新たに行方不明になった作品だけで、旧パスとタイトルを持つ", async (t) => {
  const directory = makeTestDirectory("scan-record-facts-missing");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  writeWork(root, "sub/a", ID_A, "作品A");
  writeWork(root, "b", ID_B, "作品B");
  writeWork(root, "c", ID_C, "作品C");
  const adapter = directory.own(createTestRealAdapter({ database: { kind: "memory" } }));
  await configureRoot(adapter, root);
  const first = await adapter.scan();
  assert.deepEqual(first.missingWorks, []);

  rmSync(join(root, "sub/a"), { recursive: true });
  const second = await adapter.scan();
  assert.deepEqual(second.missingWorks, [
    { workId: ID_A, title: "作品A", previousPath: workspacePath("sub/a") },
  ]);
  assert.equal(second.missing, 1);

  rmSync(join(root, "b"), { recursive: true });
  const third = await adapter.scan();
  assert.deepEqual(
    third.missingWorks.map((work) => work.workId),
    [ID_B],
  );
  assert.equal(third.missing, 2);

  const fourth = await adapter.scan();
  assert.deepEqual(fourth.missingWorks, []);
});

test("スキャン中に登録された作品は missing にならず、missingWorks にも入らない", async (t) => {
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
  assert.deepEqual(result.missingWorks, []);
});
