// サムネイルキャッシュのGC（TASK-26）: 現存する作品×THUMBNAIL_WIDTHS×現mtimeから
// 有効なキャッシュファイル名の集合を作り、それ以外の .webp を削除することを検証する。
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { THUMBNAIL_WIDTHS } from "@mimimilli/shared";
import sharp from "sharp";
import { gcThumbnailCache, getOrCreateThumbnail } from "../../src/adapters/real/thumbnailCache.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function setup(t: TestContext): { baseDir: string; cacheDir: string } {
  const directory = makeTestDirectory("thumbnail-gc");
  t.after(directory.cleanup);
  return { baseDir: directory.path, cacheDir: join(directory.path, "cache") };
}

async function writeCoverJpeg(
  path: string,
  background: { r: number; g: number; b: number },
): Promise<void> {
  await sharp({ create: { width: 200, height: 200, channels: 3, background } })
    .jpeg()
    .toFile(path);
}

test("現存する作品の現mtimeに対応するキャッシュは温存される", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverPath = join(baseDir, "cover.jpg");
  writeFileSync(coverPath, "dummy content for stat only");

  // GC自体はファイル名の一致だけで判定するため、有効キー名のダミーファイルを直接置いて検証する
  mkdirSync(cacheDir, { recursive: true });
  const { mtimeMs } = await stat(coverPath);
  const validNames = THUMBNAIL_WIDTHS.map((width) => {
    const hash = createHash("sha256").update(`work-a\0${width}\0${mtimeMs}`).digest("hex");
    return `${hash}.webp`;
  });
  for (const name of validNames) {
    writeFileSync(join(cacheDir, name), "thumb");
  }

  const result = await gcThumbnailCache(cacheDir, [
    { workId: "work-a", coverAbsolutePath: coverPath },
  ]);

  assert.equal(result.deleted, 0);
  assert.equal(result.kept, validNames.length);
  assert.equal(result.skippedWorks, 0);
  for (const name of validNames) {
    assert.ok(existsSync(join(cacheDir, name)), `${name} が残っていること`);
  }
});

test("旧mtimeキーのキャッシュファイルはカバー更新後のGCで削除される", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverPath = join(baseDir, "cover.jpg");
  await writeCoverJpeg(coverPath, { r: 10, g: 20, b: 30 });

  const oldThumbnailPaths = await Promise.all(
    THUMBNAIL_WIDTHS.map((width) =>
      getOrCreateThumbnail(cacheDir, "work-b", width, coverPath).then((t) => t.absolutePath),
    ),
  );
  for (const p of oldThumbnailPaths) assert.ok(existsSync(p));

  // カバーを更新して mtime を変える（キーが変わる）
  await new Promise((r) => setTimeout(r, 10));
  await writeCoverJpeg(coverPath, { r: 200, g: 100, b: 50 });

  const result = await gcThumbnailCache(cacheDir, [
    { workId: "work-b", coverAbsolutePath: coverPath },
  ]);

  assert.equal(result.deleted, THUMBNAIL_WIDTHS.length, "旧mtimeキーの全幅分が削除される");
  for (const p of oldThumbnailPaths) assert.ok(!existsSync(p), "旧キーのファイルは削除済み");
});

test("孤児の .tmp- ファイルは削除され、カバーをstatできない作品はスキップされ全体は止まらない", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  mkdirSync(cacheDir, { recursive: true });
  const orphanTmp = join(cacheDir, "deadbeef.webp.tmp-123-0");
  writeFileSync(orphanTmp, "orphan");

  const missingCoverPath = join(baseDir, "does-not-exist.jpg");

  const result = await gcThumbnailCache(cacheDir, [
    { workId: "work-missing", coverAbsolutePath: missingCoverPath },
  ]);

  assert.equal(result.skippedWorks, 1, "statできない作品はスキップされる");
  assert.equal(result.deleted, 1, "孤児tmpファイルは削除される");
  assert.ok(!existsSync(orphanTmp));
});

test("cacheDirがまだ作成されていない場合は削除0件で終える", async (t) => {
  const { cacheDir } = setup(t);
  const result = await gcThumbnailCache(cacheDir, []);
  assert.deepEqual(result, { deleted: 0, kept: 0, skippedWorks: 0 });
});
