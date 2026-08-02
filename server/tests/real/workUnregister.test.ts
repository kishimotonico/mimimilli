// 作品登録解除 API（DELETE /works/:id）の結合テスト。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { META_FILE_NAME, type FsListing, type Work } from "@mimimilli/shared";
import { createApp } from "../../src/app.ts";
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
