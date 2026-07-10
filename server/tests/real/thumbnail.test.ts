// カバー画像サムネイル配信（GET /api/media/cover/:id?w=）のテスト。
// 幅の正規化・ディスクキャッシュ・mtime によるキャッシュ無効化を検証する。
import assert from "node:assert/strict";
import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import type { WorksPage } from "@mimimilli/shared";
import { createRealAdapter } from "../../src/adapters/real/index.ts";
import { createApp } from "../../src/app.ts";
import { makeSampleLibrary } from "../helpers/sampleLibrary.ts";

const BASE = "data/test-thumbnail";
const CACHE_DIR = join(BASE, "cache");

async function writeCoverJpeg(
  path: string,
  size: number,
  color: { r: number; g: number; b: number },
): Promise<void> {
  await sharp({ create: { width: size, height: size, channels: 3, background: color } })
    .jpeg()
    .toFile(path);
}

async function setup() {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  const lib = makeSampleLibrary(BASE);
  const coverPath = join(lib.root, "dlsite", "RJ900001_テスト作品", "cover.jpg");
  await writeCoverJpeg(coverPath, 800, { r: 255, g: 0, b: 0 });

  const adapter = createRealAdapter({ dbPath: ":memory:", thumbnailCacheDir: CACHE_DIR });
  const app = createApp(adapter);
  await adapter.updateSettings({ rootFolder: lib.root });
  await adapter.scan();

  const res = await app.request("/api/works");
  const works = (await res.json()) as WorksPage;
  const work = works.items.find((w) => w.title.includes("RJ900001"))!;
  return { app, work, coverPath };
}

test("カバーサムネイル: w=256 で webp・幅256に縮小され、ディスクにキャッシュされる", async () => {
  const { app, work } = await setup();

  const res = await app.request(`/api/media/cover/${work.id}?w=256`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/webp");

  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  assert.equal(meta.width, 256);
  assert.equal(meta.format, "webp");

  assert.equal(readdirSync(CACHE_DIR).length, 1);
});

test("カバーサムネイル: 2回目のリクエストは再生成されない（キャッシュファイルの mtime 不変）", async () => {
  const { app, work } = await setup();

  await app.request(`/api/media/cover/${work.id}?w=256`);
  const filesBefore = readdirSync(CACHE_DIR);
  assert.equal(filesBefore.length, 1);
  const mtimeBefore = statSync(join(CACHE_DIR, filesBefore[0])).mtimeMs;

  await new Promise((r) => setTimeout(r, 20));
  await app.request(`/api/media/cover/${work.id}?w=256`);
  const filesAfter = readdirSync(CACHE_DIR);

  assert.equal(filesAfter.length, 1);
  assert.equal(filesAfter[0], filesBefore[0]);
  assert.equal(statSync(join(CACHE_DIR, filesAfter[0])).mtimeMs, mtimeBefore);
});

test("カバーサムネイル: 許可されない幅は最近傍の許可幅へ正規化される（w=200→256）", async () => {
  const { app, work } = await setup();

  const res = await app.request(`/api/media/cover/${work.id}?w=200`);
  assert.equal(res.status, 200);
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  assert.equal(meta.width, 256);
});

test("カバーサムネイル: 許可されない幅は最近傍の許可幅へ正規化される（w=400→512、512に近い側）", async () => {
  const { app, work } = await setup();

  const res = await app.request(`/api/media/cover/${work.id}?w=400`);
  assert.equal(res.status, 200);
  const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
  assert.equal(meta.width, 512);
});

test("カバーサムネイル: 元カバー更新（mtime変化）で別キャッシュが生成され、内容も更新される", async () => {
  const { app, work, coverPath } = await setup();

  const before = await app.request(`/api/media/cover/${work.id}?w=256`);
  const statsBefore = await sharp(Buffer.from(await before.arrayBuffer())).stats();
  assert.ok(statsBefore.channels[0].mean > statsBefore.channels[2].mean); // 赤が優勢
  assert.equal(readdirSync(CACHE_DIR).length, 1);

  await new Promise((r) => setTimeout(r, 20));
  await writeCoverJpeg(coverPath, 800, { r: 0, g: 0, b: 255 });

  const after = await app.request(`/api/media/cover/${work.id}?w=256`);
  const statsAfter = await sharp(Buffer.from(await after.arrayBuffer())).stats();
  assert.ok(statsAfter.channels[2].mean > statsAfter.channels[0].mean); // 更新後は青が優勢

  // mtime が変わった旧カバーのキャッシュは消さない設計のため、キャッシュファイルは2つになる
  assert.equal(readdirSync(CACHE_DIR).length, 2);
});

test("カバーサムネイル: 幅指定なしは原寸(jpeg)のまま返す", async () => {
  const { app, work } = await setup();
  const res = await app.request(`/api/media/cover/${work.id}`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/jpeg");
});

test("カバーサムネイル: 不正な w（数値でない）は 400", async () => {
  const { app, work } = await setup();
  const res = await app.request(`/api/media/cover/${work.id}?w=abc`);
  assert.equal(res.status, 400);
});
