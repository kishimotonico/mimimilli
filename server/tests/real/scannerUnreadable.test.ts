// TASK-140: スキャン中のディレクトリ読み取り失敗が missing 誤判定へ流れないことの検証。
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { Scanner } from "../../src/adapters/real/scanner.ts";
import { createWorkRepos, getTestWork } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

function metaWithSingleTrack(id: string, title: string): unknown {
  return {
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
  };
}

function withRestoredMode(
  path: string,
  mode: number,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    chmodSync(path, 0o000);
    try {
      await fn();
    } finally {
      chmodSync(path, mode);
    }
  };
}

test("ルート読取失敗: スキャンがエラー終了し missing 更新されない", async (t) => {
  const directory = makeTestDirectory("scan-root-unreadable");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const workDir = join(root, "work");
  const workId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  mkdirSync(workDir, { recursive: true });
  writeWav(join(workDir, "track.wav"), 1);
  writeFileSync(
    join(workDir, "mimimilli.json"),
    JSON.stringify(metaWithSingleTrack(workId, "work")),
  );

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  await adapter.updateSettings({ rootFolder: root });
  await adapter.scan();

  const workBefore = await adapter.getWork(workId);
  assert.equal(workBefore?.status, "ok");

  const rootMode = statSync(root).mode & 0o777;
  t.after(() => chmodSync(root, rootMode));
  await withRestoredMode(root, rootMode, async () => {
    await assert.rejects(adapter.scan(), /ルートフォルダーを読み取れません/);
  })();

  const workAfter = await adapter.getWork(workId);
  assert.equal(workAfter?.status, "ok");
});

test("サブツリー読取失敗: 配下の既存作品は missing 化されず結果に報告される", async (t) => {
  const directory = makeTestDirectory("scan-subtree-unreadable");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const accessibleDir = join(root, "accessible");
  const blockedDir = join(root, "blocked", "nested");
  const accessibleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const blockedId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  for (const [dir, id, title] of [
    [accessibleDir, accessibleId, "accessible-work"],
    [blockedDir, blockedId, "blocked-work"],
  ] as const) {
    mkdirSync(dir, { recursive: true });
    writeWav(join(dir, "track.wav"), 1);
    writeFileSync(join(dir, "mimimilli.json"), JSON.stringify(metaWithSingleTrack(id, title)));
  }

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  await scanner.scan(root);

  assert.equal((await getTestWork(db, accessibleId))?.status, "ok");
  assert.equal((await getTestWork(db, blockedId))?.status, "ok");

  const blockedRoot = join(root, "blocked");
  const blockedMode = statSync(blockedRoot).mode & 0o777;
  t.after(() => chmodSync(blockedRoot, blockedMode));
  await withRestoredMode(blockedRoot, blockedMode, async () => {
    const result = await scanner.scan(root);
    assert.ok(result.unreadablePaths?.includes(blockedRoot));
    assert.equal((await getTestWork(db, blockedId))?.status, "ok");
    assert.equal((await getTestWork(db, accessibleId))?.status, "ok");
  })();
});

test("サブツリー読取失敗: 読取可能な削除作品は引き続き missing になる", async (t) => {
  const directory = makeTestDirectory("scan-subtree-missing-still-works");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const accessibleDir = join(root, "accessible");
  const blockedDir = join(root, "blocked");
  const removedDir = join(root, "removed");
  const accessibleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  const blockedId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
  const removedId = "ffffffff-ffff-4fff-8fff-ffffffffffff";

  for (const [dir, id, title] of [
    [accessibleDir, accessibleId, "accessible-work"],
    [blockedDir, blockedId, "blocked-work"],
    [removedDir, removedId, "removed-work"],
  ] as const) {
    mkdirSync(dir, { recursive: true });
    writeWav(join(dir, "track.wav"), 1);
    writeFileSync(join(dir, "mimimilli.json"), JSON.stringify(metaWithSingleTrack(id, title)));
  }

  const db = openDb({ kind: "memory" });
  t.after(() => db.close());
  const repos = createWorkRepos(db);
  const scanner = new Scanner(db, repos);
  await scanner.scan(root);

  rmSync(removedDir, { recursive: true });

  const blockedMode = statSync(blockedDir).mode & 0o777;
  t.after(() => chmodSync(blockedDir, blockedMode));
  await withRestoredMode(blockedDir, blockedMode, async () => {
    const result = await scanner.scan(root);
    assert.ok(result.unreadablePaths?.includes(blockedDir));
    assert.equal((await getTestWork(db, blockedId))?.status, "ok");
    assert.equal((await getTestWork(db, removedId))?.status, "missing");
    assert.equal((await getTestWork(db, accessibleId))?.status, "ok");
    assert.equal(result.missing, 1);
  })();
});
