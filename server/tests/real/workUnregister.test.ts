// 作品登録解除 API（DELETE /works/:id）の結合テスト。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { test, type TestContext } from "node:test";
import { META_FILE_NAME, type FsListing, type Work } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { unregisterWork } from "../../src/adapters/real/workRegister.ts";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { workStates } from "../../src/adapters/real/userSchema.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { folderMetaPath } from "../helpers/workTestUtils.ts";
import { makeTestDirectory, writeWav } from "../helpers/sampleLibrary.ts";

interface FileSnapshot {
  path: string;
  size: number;
  hash: string;
}

function snapshotFiles(root: string, excludeMeta = false): FileSnapshot[] {
  const out: FileSnapshot[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (excludeMeta && (name === META_FILE_NAME || name.endsWith(".mimimilli.json"))) continue;
      const stat = statSync(full);
      if (stat.isDirectory()) {
        stack.push(full);
      } else {
        const body = readFileSync(full);
        out.push({
          path: full,
          size: stat.size,
          hash: createHash("sha256").update(body).digest("hex"),
        });
      }
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

async function setupRegisteredWork(t: TestContext) {
  const directory = makeTestDirectory("work-unregister");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900020_unregister");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);
  writeFileSync(join(folder, "readme.txt"), "notes");

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "解除テスト作品" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;

  const patchRes = await app.request(`/api/works/${work.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tags: ["ジャンル/テスト", "サークル/解除用"] }),
  });
  assert.equal(patchRes.status, 200);

  const lastPlayedRes = await app.request(`/api/works/${work.id}/last-played`, {
    method: "POST",
  });
  assert.equal(lastPlayedRes.status, 204);

  const beforeDelete = (await (await app.request(`/api/works/${work.id}`)).json()) as Work;
  assert.deepEqual(beforeDelete.tags, ["ジャンル/テスト", "サークル/解除用"]);
  assert.ok(beforeDelete.lastPlayedAt);

  return { app, root, folder, work };
}

test("DELETE /works/:id: メタファイルとDB上の作品データ（履歴・タグ含む）を削除する", async (t) => {
  const { app, folder, work } = await setupRegisteredWork(t);
  assert.ok(existsSync(folderMetaPath(folder)));

  const before = snapshotFiles(folder, true);
  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);
  assert.ok(!existsSync(folderMetaPath(folder)));

  const gone = await app.request(`/api/works/${work.id}`);
  assert.equal(gone.status, 404);

  const listRes = await app.request("/api/works");
  assert.equal(listRes.status, 200);
  const listBody = await listRes.json();
  assert.ok(!listBody.items.some((item: { id: string }) => item.id === work.id));

  const after = snapshotFiles(folder, true);
  assert.deepEqual(after, before);
});

test("DELETE /works/:id: 解除後はファイルモードで未登録フォルダーとして表示される", async (t) => {
  const { app, folder, work } = await setupRegisteredWork(t);

  const beforeListing = (await (
    await app.request(`/api/fs?path=${encodeURIComponent(folder)}`)
  ).json()) as FsListing;
  assert.equal(beforeListing.workId, work.id);

  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);

  const afterListing = (await (
    await app.request(`/api/fs?path=${encodeURIComponent(folder)}`)
  ).json()) as FsListing;
  assert.equal(afterListing.workId, null);
  const dirEntry = afterListing.entries.find((e) => e.name === "track.wav");
  assert.equal(dirEntry?.workId, null);
});

test("DELETE /works/:id: 存在しない作品IDは 404", async (t) => {
  const directory = makeTestDirectory("work-unregister-missing");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const res = await app.request("/api/works/00000000-0000-4000-8000-000000000000", {
    method: "DELETE",
  });
  assert.equal(res.status, 404);
});

test("DELETE /works/:id: 不正な作品IDは 404", async (t) => {
  const directory = makeTestDirectory("work-unregister-invalid");
  t.after(directory.cleanup);
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });

  const adapter = createTestRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const res = await app.request("/api/works/not-a-valid-id", { method: "DELETE" });
  assert.equal(res.status, 404);
});

test("DELETE /works/:id: 解除前後で音声等の物理ファイルは変更されない", async (t) => {
  const { app, folder, work } = await setupRegisteredWork(t);
  const before = snapshotFiles(folder, true);

  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);

  const after = snapshotFiles(folder, true);
  assert.deepEqual(after, before);
  assert.ok(existsSync(join(folder, "track.wav")));
  assert.ok(existsSync(join(folder, "readme.txt")));
});

test("DELETE /works/:id: 解除後に同じフォルダーを再登録できる", async (t) => {
  const { app, folder, work } = await setupRegisteredWork(t);

  const delRes = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(delRes.status, 204);

  const previewRes = await app.request(
    `/api/works/register-preview?path=${encodeURIComponent(folder)}`,
  );
  assert.equal(previewRes.status, 200);
  const preview = await previewRes.json();
  assert.equal(preview.alreadyRegistered, false);

  const reRegRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "再登録作品" }),
  });
  assert.equal(reRegRes.status, 201);
  const reRegBody = await reRegRes.json();
  assert.equal(reRegBody.title, "再登録作品");
  assert.equal(reRegBody.physicalPath, folder);
  assert.ok(existsSync(folderMetaPath(folder)));
});

test("DELETE /works/:id: メタ削除に失敗した場合はDB上の作品データを保持する", async (t) => {
  const { app, folder, work } = await setupRegisteredWork(t);
  const metaPath = folderMetaPath(folder);
  assert.ok(existsSync(metaPath));

  const { chmodSync } = await import("node:fs");
  chmodSync(folder, 0o555);

  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.notEqual(res.status, 204);

  const stillThere = await app.request(`/api/works/${work.id}`);
  assert.equal(stillThere.status, 200);
  const body = await stillThere.json();
  assert.equal(body.id, work.id);
  assert.ok(existsSync(metaPath));

  chmodSync(folder, 0o755);
});

test("DELETE /works/:id: DBのmeta_pathが古い場合でもid一致のmimimilli.jsonを削除する", async (t) => {
  const directory = makeTestDirectory("work-unregister-stale-meta-path");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900021_stale_meta");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);

  const adapter = createTestRealAdapter({
    database: { kind: "files", catalogPath, userPath },
  });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "古いmeta_pathテスト" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;
  const actualMetaPath = folderMetaPath(folder);
  assert.ok(existsSync(actualMetaPath));

  const staleMetaPath = join(folder, ".meta.json");
  const db = openDb({ kind: "files", catalogPath, userPath });
  db.sqlite.run("UPDATE main.works SET meta_path = ? WHERE id = ?", [staleMetaPath, work.id]);
  db.close();

  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);
  assert.ok(!existsSync(actualMetaPath));
});

test("DELETE /works/:id: id不一致のmimimilli.jsonは削除しない", async (t) => {
  const directory = makeTestDirectory("work-unregister-meta-id-mismatch");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900022_meta_mismatch");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);

  const adapter = createTestRealAdapter({
    database: { kind: "files", catalogPath, userPath },
  });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "id不一致テスト" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;
  const actualMetaPath = folderMetaPath(folder);
  assert.ok(existsSync(actualMetaPath));

  const otherId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const meta = JSON.parse(readFileSync(actualMetaPath, "utf-8")) as { id: string };
  meta.id = otherId;
  writeFileSync(actualMetaPath, JSON.stringify(meta, null, 2));

  const staleMetaPath = join(folder, ".meta.json");
  const db = openDb({ kind: "files", catalogPath, userPath });
  db.sqlite.run("UPDATE main.works SET meta_path = ? WHERE id = ?", [staleMetaPath, work.id]);
  db.close();

  const res = await app.request(`/api/works/${work.id}`, { method: "DELETE" });
  assert.equal(res.status, 204);
  assert.ok(existsSync(actualMetaPath));
  const remaining = JSON.parse(readFileSync(actualMetaPath, "utf-8")) as { id: string };
  assert.equal(remaining.id, otherId);
});

test("unregisterWork: DB削除失敗時に退避したメタ正本を復元する", async (t) => {
  const directory = makeTestDirectory("work-unregister-db-failure");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900023_db_failure");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);

  const adapter = createTestRealAdapter({
    database: { kind: "files", catalogPath, userPath },
  });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "DB失敗テスト" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;
  const metaPath = folderMetaPath(folder);
  const metaBefore = readFileSync(metaPath, "utf-8");
  assert.ok(existsSync(metaPath));

  const db = openDb({ kind: "files", catalogPath, userPath });
  const repo = new WorkRepo(db);
  repo.deleteWork = () => {
    throw new Error("simulated db delete failure");
  };

  assert.throws(
    () => unregisterWork(repo, work.id),
    (error: Error) => error.message.includes("simulated db delete failure"),
  );
  db.close();

  assert.ok(existsSync(metaPath));
  assert.equal(readFileSync(metaPath, "utf-8"), metaBefore);
  assert.ok(!existsSync(join(folder, `.${META_FILE_NAME}.unregistering`)));

  const stillThere = await app.request(`/api/works/${work.id}`);
  assert.equal(stillThere.status, 200);
});

test("unregisterWork: catalog削除後のuser削除失敗時はメタを復元し起動時整合性検査を通す", async (t) => {
  const directory = makeTestDirectory("work-unregister-user-delete-failure");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900025_user_failure");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);

  const adapter = createTestRealAdapter({
    database: { kind: "files", catalogPath, userPath },
  });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "user削除失敗テスト" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;
  const metaPath = folderMetaPath(folder);
  const metaBefore = readFileSync(metaPath, "utf-8");
  const stagedPath = join(folder, `.${META_FILE_NAME}.unregistering`);

  const db = openDb({ kind: "files", catalogPath, userPath });
  const repo = new WorkRepo(db);
  db.userTransaction = () => {
    throw new Error("simulated user delete failure");
  };

  assert.throws(
    () => unregisterWork(repo, work.id),
    (error: Error) => error.message.includes("simulated user delete failure"),
  );

  assert.ok(existsSync(metaPath));
  assert.equal(readFileSync(metaPath, "utf-8"), metaBefore);
  assert.ok(!existsSync(stagedPath));

  const catalogRow = db.sqlite.query("SELECT id FROM works WHERE id = ?").get(work.id) as {
    id: string;
  } | null;
  assert.equal(catalogRow, null);

  const userRow = db.user.select().from(workStates).where(eq(workStates.workId, work.id)).get();
  assert.ok(userRow);

  const integrityViolation = db.sqlite
    .query(
      "SELECT works.id FROM works LEFT JOIN user.work_states ON work_states.work_id = works.id " +
        "WHERE work_states.work_id IS NULL LIMIT 1",
    )
    .get();
  assert.equal(integrityViolation, null);

  db.close();

  const reopened = openDb({ kind: "files", catalogPath, userPath });
  reopened.close();

  const gone = await app.request(`/api/works/${work.id}`);
  assert.equal(gone.status, 404);
});

test("unregisterWork: 退避済みメタのまま再実行するとDB削除後に実削除する", async (t) => {
  const directory = makeTestDirectory("work-unregister-staged-retry");
  t.after(directory.cleanup);
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  const folder = join(root, "RJ900024_staged_retry");
  mkdirSync(folder, { recursive: true });
  writeWav(join(folder, "track.wav"), 2);

  const adapter = createTestRealAdapter({
    database: { kind: "files", catalogPath, userPath },
  });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: root });

  const createRes = await app.request("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: folder, title: "退避再実行テスト" }),
  });
  assert.equal(createRes.status, 201);
  const work = (await createRes.json()) as Work;
  const metaPath = folderMetaPath(folder);
  const stagedPath = join(folder, `.${META_FILE_NAME}.unregistering`);
  renameSync(metaPath, stagedPath);
  assert.ok(!existsSync(metaPath));
  assert.ok(existsSync(stagedPath));

  const db = openDb({ kind: "files", catalogPath, userPath });
  const repo = new WorkRepo(db);
  assert.equal(unregisterWork(repo, work.id), true);
  db.close();

  assert.ok(!existsSync(metaPath));
  assert.ok(!existsSync(stagedPath));
  const gone = await app.request(`/api/works/${work.id}`);
  assert.equal(gone.status, 404);
});
