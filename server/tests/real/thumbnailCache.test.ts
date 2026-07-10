// サムネイル初回生成の排他（TASK-32）: 同一キャッシュキーへの同時リクエストが
// 変換を1回だけ実行すること、生成失敗時に残骸を残さず再試行できることを検証する。
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { getOrCreateThumbnail } from "../../src/adapters/real/thumbnailCache.ts";

const BASE = "data/test-thumbnail-cache";
const CACHE_DIR = join(BASE, "cache");

async function writeCoverJpeg(path: string): Promise<void> {
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toFile(path);
}

test("同一キーへの同時リクエストは変換を1回だけ実行し、全員同じ完成ファイルを受け取る", async () => {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  mkdirSync(BASE, { recursive: true });
  const coverPath = join(BASE, "cover-concurrent.jpg");
  await writeCoverJpeg(coverPath);

  const promises = Array.from({ length: 5 }, () =>
    getOrCreateThumbnail(CACHE_DIR, "work-concurrent", 256, coverPath),
  );
  const results = await Promise.all(promises);

  const first = results[0]!;
  for (const r of results) {
    assert.equal(r.absolutePath, first.absolutePath);
    assert.equal(r.mime, "image/webp");
  }

  // 完成ファイルのみが残り、一時ファイルの残骸は無い
  const files = readdirSync(CACHE_DIR);
  assert.equal(files.length, 1);
  assert.ok(!files[0]!.includes(".tmp-"));
  assert.ok(existsSync(first.absolutePath));
});

test("異なるキーの生成は並行のまま進む", async () => {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  mkdirSync(BASE, { recursive: true });
  const coverA = join(BASE, "cover-a.jpg");
  const coverB = join(BASE, "cover-b.jpg");
  await Promise.all([writeCoverJpeg(coverA), writeCoverJpeg(coverB)]);

  const [resultA, resultB] = await Promise.all([
    getOrCreateThumbnail(CACHE_DIR, "work-a", 256, coverA),
    getOrCreateThumbnail(CACHE_DIR, "work-b", 256, coverB),
  ]);

  assert.notEqual(resultA.absolutePath, resultB.absolutePath);
  assert.equal(readdirSync(CACHE_DIR).length, 2);
});

test("生成失敗時は壊れたキャッシュを残さず、修正後の再試行で成功する", async () => {
  rmSync(CACHE_DIR, { recursive: true, force: true });
  mkdirSync(BASE, { recursive: true });
  const brokenPath = join(BASE, "broken.jpg");
  writeFileSync(brokenPath, "これは画像ではない");

  await assert.rejects(() => getOrCreateThumbnail(CACHE_DIR, "work-broken", 256, brokenPath));

  if (existsSync(CACHE_DIR)) {
    const files = readdirSync(CACHE_DIR);
    assert.equal(
      files.filter((f) => f.includes(".tmp-")).length,
      0,
      "一時ファイルの残骸が無いこと",
    );
    assert.equal(files.length, 0, "失敗したキャッシュファイルが無いこと");
  }

  await writeCoverJpeg(brokenPath);
  const result = await getOrCreateThumbnail(CACHE_DIR, "work-broken", 256, brokenPath);
  assert.ok(existsSync(result.absolutePath));
});
