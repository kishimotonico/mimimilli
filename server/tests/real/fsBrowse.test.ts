// 物理 FS ブラウズ（/api/fs）の結合テスト: ルート外遮断・作品対応付け・管理ファイル非表示。
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";
import type { FsListing, WorkSummary, WorksPage } from "@mimimilli/shared";
import type { Hono } from "hono";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { buildWorkPathIndex, findOwnerWork } from "../../src/adapters/real/fsBrowse.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary, writeWav } from "../helpers/sampleLibrary.ts";

async function setup(t: TestContext, prepare?: (root: string) => void) {
  const lib = makeSampleLibrary();
  t.after(lib.cleanup);
  prepare?.(lib.root);
  const adapter = createRealAdapter({ database: { kind: "memory" } });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();
  return { app, root: resolve(lib.root), existingWorkId: lib.existingWorkId };
}

function workAt(id: string, physicalPath: string): WorkSummary {
  return { id, physicalPath } as WorkSummary;
}

class LookupCountingMap<K, V> extends Map<K, V> {
  getCalls = 0;

  override get(key: K): V | undefined {
    this.getCalls += 1;
    return super.get(key);
  }
}

async function listing(app: Hono, path?: string): Promise<FsListing> {
  const q = path ? `?path=${encodeURIComponent(path)}` : "";
  const res = await app.request(`/api/fs${q}`);
  assert.equal(res.status, 200);
  return (await res.json()) as FsListing;
}

test("ルート外のパス指定は 404", async (t) => {
  const { app } = await setup(t);
  for (const path of ["/etc", "/", join("data", "..")]) {
    const res = await app.request(`/api/fs?path=${encodeURIComponent(path)}`);
    assert.equal(res.status, 404, `should block: ${path}`);
  }
});

test("作品ディレクトリには workId、作品配下のファイルには workId + workRelPath が付く", async (t) => {
  const { app, root, existingWorkId } = await setup(t);

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

test("listing 自身の workId と parent、.meta.json の非表示", async (t) => {
  const { app, root, existingWorkId } = await setup(t);

  const workListing = await listing(app, join(root, "dlsite", "RJ900002_既存メタ"));
  assert.equal(workListing.workId, existingWorkId);
  assert.equal(workListing.parent, join(root, "dlsite"));
  assert.ok(!workListing.entries.some((e) => e.name.endsWith(".meta.json")));

  const rootListing = await listing(app);
  assert.equal(rootListing.parent, null);
});

test("ネストした作品ルートではファイルを最も深い作品へ対応付ける", async (t) => {
  const nestedId = "22222222-2222-4222-8222-222222222222";
  const { app, root, existingWorkId } = await setup(t, (libraryRoot) => {
    const nested = join(libraryRoot, "dlsite", "RJ900002_既存メタ", "nested-work");
    mkdirSync(nested, { recursive: true });
    writeWav(join(nested, "nested.wav"), 1);
    writeFileSync(
      join(nested, ".meta.json"),
      JSON.stringify({
        id: nestedId,
        title: "ネストした作品",
        tags: [],
        playlists: [{ name: "default", tracks: [{ title: "nested", file: "nested.wav" }] }],
        defaultPlaylist: "default",
      }),
    );
  });

  const parent = await listing(app, join(root, "dlsite", "RJ900002_既存メタ"));
  assert.equal(parent.workId, existingWorkId);
  assert.equal(parent.entries.find((entry) => entry.name === "nested-work")?.workId, nestedId);

  const nested = await listing(app, join(root, "dlsite", "RJ900002_既存メタ", "nested-work"));
  const file = nested.entries.find((entry) => entry.name === "nested.wav");
  assert.equal(file?.workId, nestedId);
  assert.equal(file?.workRelPath, "nested.wav");
});

test("物理パス索引は境界・重複・未登録を保ち、所有者探索は全作品走査しない", () => {
  const first = workAt("first", "/library/work");
  const duplicate = workAt("duplicate", "/library/work");
  const indexed = buildWorkPathIndex([first, duplicate]);
  assert.equal(indexed.get("/library/work")?.id, "first");
  assert.equal(findOwnerWork("/library", "/library/work-other/file.wav", indexed), null);
  assert.equal(findOwnerWork("/library", "/library/unregistered/file.wav", indexed), null);

  const works = [
    workAt("owner", "/library/registered"),
    ...Array.from({ length: 10_000 }, (_, i) => workAt(`other-${i}`, `/library/other-${i}`)),
  ];
  const countingIndex = new LookupCountingMap(buildWorkPathIndex(works));
  const owner = findOwnerWork("/library", "/library/registered/deep/file.wav", countingIndex);
  assert.equal(owner?.id, "owner");
  assert.equal(countingIndex.getCalls, 3);
});
