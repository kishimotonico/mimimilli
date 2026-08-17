// サムネイルキャッシュのGC（TASK-26）: validNames に含まれないエントリを削除することを検証する。
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import sharp from "sharp";
import {
  gcThumbnailCache,
  ThumbnailCache,
  thumbnailCacheNames,
} from "../../src/adapters/real/thumbnailCache.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function setup(t: TestContext): {
  baseDir: string;
  cacheDir: string;
  cache: ThumbnailCache;
} {
  const directory = makeTestDirectory("thumbnail-gc");
  t.after(directory.cleanup);
  return {
    baseDir: directory.path,
    cacheDir: join(directory.path, "cache"),
    cache: new ThumbnailCache(),
  };
}

async function writeCoverJpeg(
  path: string,
  background: { r: number; g: number; b: number },
): Promise<void> {
  await sharp({ create: { width: 200, height: 200, channels: 3, background } })
    .jpeg()
    .toFile(path);
}

test("validNames に含まれるキャッシュは温存される", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverPath = join(baseDir, "cover.jpg");
  writeFileSync(coverPath, "dummy content for stat only");

  mkdirSync(cacheDir, { recursive: true });
  const { size, mtimeMs } = await stat(coverPath);
  const validNames = new Set(thumbnailCacheNames("work-a", { size, mtimeMs }));
  for (const name of validNames) {
    writeFileSync(join(cacheDir, name), "thumb");
  }

  const result = await gcThumbnailCache(cacheDir, validNames);

  assert.equal(result.deleted, 0);
  assert.equal(result.kept, validNames.size);
  for (const name of validNames) {
    assert.ok(existsSync(join(cacheDir, name)), `${name} が残っていること`);
  }
});

test("旧mtimeキーのキャッシュファイルは新しい validNames で削除される", async (t) => {
  const { baseDir, cacheDir, cache } = setup(t);
  const coverPath = join(baseDir, "cover.jpg");
  await writeCoverJpeg(coverPath, { r: 10, g: 20, b: 30 });

  const oldThumbnailPaths = await Promise.all(
    THUMBNAIL_WIDTHS.map((width) =>
      cache.getOrCreate(cacheDir, "work-b", width, coverPath).then((thumb) => thumb.absolutePath),
    ),
  );
  for (const p of oldThumbnailPaths) assert.ok(existsSync(p));

  await new Promise((r) => setTimeout(r, 10));
  await writeCoverJpeg(coverPath, { r: 200, g: 100, b: 50 });

  const { size, mtimeMs } = await stat(coverPath);
  const validNames = new Set(thumbnailCacheNames("work-b", { size, mtimeMs }));
  const result = await gcThumbnailCache(cacheDir, validNames);

  assert.equal(result.deleted, THUMBNAIL_WIDTHS.length, "旧mtimeキーの全幅分が削除される");
  for (const p of oldThumbnailPaths) assert.ok(!existsSync(p), "旧キーのファイルは削除済み");
});

test("孤児の .webp と .tmp- ファイルは削除される", async (t) => {
  const { cacheDir } = setup(t);
  mkdirSync(cacheDir, { recursive: true });
  const orphanTmp = join(cacheDir, "deadbeef.webp.tmp-123-0");
  const orphanWebp = join(cacheDir, "orphan.webp");
  writeFileSync(orphanTmp, "orphan");
  writeFileSync(orphanWebp, "orphan");

  const result = await gcThumbnailCache(cacheDir, new Set());

  assert.equal(result.deleted, 2);
  assert.ok(!existsSync(orphanTmp));
  assert.ok(!existsSync(orphanWebp));
});

test("cacheDirがまだ作成されていない場合は削除0件で終える", async (t) => {
  const { cacheDir } = setup(t);
  const result = await gcThumbnailCache(cacheDir, new Set());
  assert.deepEqual(result, { deleted: 0, kept: 0 });
});
