// サムネイル初回生成の排他（TASK-32）: 同一キャッシュキーへの同時リクエストが
// 変換を1回だけ実行すること、生成失敗時に残骸を残さず再試行できることを検証する。
import assert from "node:assert/strict";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import sharp from "sharp";
import { getOrCreateThumbnail } from "../../src/adapters/real/thumbnailCache.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

function setup(t: TestContext): { baseDir: string; cacheDir: string } {
  const directory = makeTestDirectory("thumbnail-cache");
  t.after(directory.cleanup);
  return { baseDir: directory.path, cacheDir: join(directory.path, "cache") };
}

async function writeCoverJpeg(path: string): Promise<void> {
  await sharp({
    create: { width: 400, height: 400, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toFile(path);
}

test("同一キーへの同時リクエストは変換を1回だけ実行し、全員同じ完成ファイルを受け取る", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverPath = join(baseDir, "cover-concurrent.jpg");
  await writeCoverJpeg(coverPath);

  const promises = Array.from({ length: 5 }, () =>
    getOrCreateThumbnail(cacheDir, "work-concurrent", 256, coverPath),
  );
  const results = await Promise.all(promises);

  const first = results[0]!;
  for (const r of results) {
    assert.equal(r.absolutePath, first.absolutePath);
    assert.equal(r.mime, "image/webp");
  }

  // 完成ファイルのみが残り、一時ファイルの残骸は無い
  const files = readdirSync(cacheDir);
  assert.equal(files.length, 1);
  assert.ok(!files[0]!.includes(".tmp-"));
  assert.ok(existsSync(first.absolutePath));
});

test("異なるキーの生成は並行のまま進む", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverA = join(baseDir, "cover-a.jpg");
  const coverB = join(baseDir, "cover-b.jpg");
  await Promise.all([writeCoverJpeg(coverA), writeCoverJpeg(coverB)]);

  const [resultA, resultB] = await Promise.all([
    getOrCreateThumbnail(cacheDir, "work-a", 256, coverA),
    getOrCreateThumbnail(cacheDir, "work-b", 256, coverB),
  ]);

  assert.notEqual(resultA.absolutePath, resultB.absolutePath);
  assert.equal(readdirSync(cacheDir).length, 2);
});

test("生成失敗時は壊れたキャッシュを残さず、修正後の再試行で成功する", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const brokenPath = join(baseDir, "broken.jpg");
  writeFileSync(brokenPath, "これは画像ではない");

  await assert.rejects(() => getOrCreateThumbnail(cacheDir, "work-broken", 256, brokenPath));

  if (existsSync(cacheDir)) {
    const files = readdirSync(cacheDir);
    assert.equal(
      files.filter((f) => f.includes(".tmp-")).length,
      0,
      "一時ファイルの残骸が無いこと",
    );
    assert.equal(files.length, 0, "失敗したキャッシュファイルが無いこと");
  }

  await writeCoverJpeg(brokenPath);
  const result = await getOrCreateThumbnail(cacheDir, "work-broken", 256, brokenPath);
  assert.ok(existsSync(result.absolutePath));
});
