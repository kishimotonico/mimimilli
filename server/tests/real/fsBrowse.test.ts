// 物理 FS ブラウズ（/api/fs）の結合テスト: ルート外遮断・作品対応付け・管理ファイル非表示。
import assert from "node:assert/strict";
import { join, resolve } from "node:path";
import { test } from "node:test";
import type { FsListing, WorksPage } from "@mimikago/shared";
import type { Hono } from "hono";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

const BASE = "data/test-fsbrowse";

async function setup() {
  const lib = makeSampleLibrary(BASE);
  const adapter = createRealAdapter({ dbPath: ":memory:" });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return { app, root: resolve(lib.root), existingWorkId: lib.existingWorkId };
}

async function listing(app: Hono, path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await app.request(`/api/fs${q}`);
  assert.equal(res.status, 200);
  return (await res.json()) as FsListing;
}

test("ルート外のパス指定は 404", async () => {
  const { app } = await setup();
  for (const path of ["/etc", "/", join("data", "..")]) {
    const res = await app.request(`/api/fs?path=${encodeURIComponent(path)}`);
    assert.equal(res.status, 404, `should block: ${path}`);
  }
});

test("作品ディレクトリには workId、作品配下のファイルには workId + workRelPath が付く", async () => {
  const { app, root, existingWorkId } = await setup();

  const dlsite = await listing(app, join(root, "dlsite"));
  const workDir = dlsite.entries.find((e) => e.name === "RJ900002_既存メタ");
  assert.equal(workDir?.isDir, true);
  assert.equal(workDir?.workId, existingWorkId);

  // 作品配下のサブフォルダー内ファイル（mp3/01_intro.wav）
  const works = (await (await app.request("/api/works")).json()) as WorksPage;
  const generated = works.items.find((w) => w.title.includes("RJ900001"))!;
  const mp3 = await listing(app, join(root, "dlsite", "RJ900001_テスト作品", "mp3"));
  const file = mp3.entries.find((e) => e.name === "01_intro.wav");
  assert.equal(file?.workId, generated.id);
  assert.equal(file?.workRelPath, "mp3/01_intro.wav");
  assert.equal(file?.fileType, "wav");
  assert.ok((file?.size ?? 0) > 0);
});

test("listing 自身の workId と parent、.meta.json の非表示", async () => {
  const { app, root, existingWorkId } = await setup();

  const workListing = await listing(app, join(root, "dlsite", "RJ900002_既存メタ"));
  assert.equal(workListing.workId, existingWorkId);
  assert.equal(workListing.parent, join(root, "dlsite"));
  assert.ok(!workListing.entries.some((e) => e.name.endsWith(".meta.json")));

  const rootListing = await listing(app);
  assert.equal(rootListing.parent, null);
});
