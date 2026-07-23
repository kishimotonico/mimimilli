// サムネイル初回生成の排他（TASK-32）: 同一キャッシュキーへの同時リクエストが
// 変換を1回だけ実行すること、生成失敗時に残骸を残さず再試行できることを検証する。
import assert from "node:assert/strict";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { rename, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import sharp from "sharp";
import { getOrCreateThumbnail, ThumbnailCache } from "../../src/adapters/real/thumbnailCache.ts";
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
    assert.equal(r.size, first.size);
  }
  assert.ok(first.size > 0);

  // 完成ファイルのみが残り、一時ファイルの残骸は無い
  const files = readdirSync(cacheDir);
  assert.equal(files.length, 1);
  assert.ok(!files[0]!.includes(".tmp-"));
  assert.ok(existsSync(first.absolutePath));
});

test("キャッシュヒット時もファイルの実サイズを返す", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverPath = join(baseDir, "cover-cached.jpg");
  await writeCoverJpeg(coverPath);

  const first = await getOrCreateThumbnail(cacheDir, "work-cached", 256, coverPath);
  const second = await getOrCreateThumbnail(cacheDir, "work-cached", 256, coverPath);

  assert.equal(second.absolutePath, first.absolutePath);
  assert.equal(second.size, first.size);
  assert.ok(second.size > 0);
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

test("異なるキーはSharp側semaphoreの上限以下に変換し、同一キーはqueue投入前に合流する", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  let running = 0;
  let maxRunning = 0;
  const started: string[] = [];
  const cache = new ThumbnailCache({
    maxConcurrent: 1,
    async transform({ sourceAbsolutePath, tmpPath }) {
      started.push(sourceAbsolutePath);
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await writeFile(tmpPath, "thumbnail");
      running--;
    },
  });
  const source = { size: 1, mtimeMs: 1 };
  const first = cache.getOrCreate(cacheDir, "a", 256, join(baseDir, "a.jpg"), source);
  const duplicate = cache.getOrCreate(cacheDir, "a", 256, join(baseDir, "a.jpg"), source);
  const second = cache.getOrCreate(cacheDir, "b", 256, join(baseDir, "b.jpg"), source);
  const [a, aAgain, b] = await Promise.all([first, duplicate, second]);

  // admission（stat/mkdir/inFlight登録）はキー単位のロックに縮小されており、異なるキー間の
  // 開始順序は保証しない（TASK-87）。変換の同時実行数がmaxConcurrentを超えないことと、
  // 両方とも実行されたことだけを検証する。
  assert.equal(maxRunning, 1);
  assert.deepEqual([...started].sort(), [join(baseDir, "a.jpg"), join(baseDir, "b.jpg")].sort());
  assert.equal(a.absolutePath, aAgain.absolutePath);
  assert.notEqual(a.absolutePath, b.absolutePath);
});

test("片方のキーのadmission判定が保留中でも、別キーのキャッシュヒットはブロックされず解決する", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const coverSlow = join(baseDir, "cover-slow.jpg");
  const coverFast = join(baseDir, "cover-fast.jpg");
  await Promise.all([writeCoverJpeg(coverSlow), writeCoverJpeg(coverFast)]);
  const source = { size: 1, mtimeMs: 1 };

  // fast-key は先に生成しておき、以降はキャッシュヒットになる状態を作る。
  await getOrCreateThumbnail(cacheDir, "fast-key", 256, coverFast, source);

  let resolveGate: (value: number | null) => void = () => {};
  const gate = new Promise<number | null>((resolve) => {
    resolveGate = resolve;
  });
  let calls = 0;
  const cache = new ThumbnailCache({
    async statCachedFile(path) {
      calls++;
      // 最初の呼び出し（slow-key側）だけ意図的にゲートで止め、admission判定を保留にする。
      if (calls === 1) return gate;
      try {
        return (await stat(path)).size;
      } catch {
        return null;
      }
    },
  });

  const slow = cache.getOrCreate(cacheDir, "slow-key", 256, coverSlow, source);
  const raced = await Promise.race([
    cache.getOrCreate(cacheDir, "fast-key", 256, coverFast, source),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), 200)),
  ]);
  assert.notEqual(raced, "timeout", "別キーのキャッシュヒットが保留中のadmissionに待たされている");

  resolveGate(null);
  const slowResult = await slow;
  assert.ok(existsSync(slowResult.absolutePath));
});

test("queued/runningの失敗後もslotを解放し、同じキーを再試行できる", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  let shouldFail = true;
  const cache = new ThumbnailCache({
    maxConcurrent: 1,
    async transform({ tmpPath }) {
      if (shouldFail) throw new Error("transform failed");
      await writeFile(tmpPath, "thumbnail");
    },
  });
  const source = { size: 1, mtimeMs: 1 };
  const sourcePath = join(baseDir, "retry.jpg");
  await assert.rejects(() => cache.getOrCreate(cacheDir, "retry", 256, sourcePath, source));
  assert.ok(
    !existsSync(cacheDir) || readdirSync(cacheDir).every((name) => !name.includes(".tmp-")),
  );

  shouldFail = false;
  const result = await cache.getOrCreate(cacheDir, "retry", 256, sourcePath, source);
  assert.ok(existsSync(result.absolutePath));
});

test("tmp作成後のasync失敗でも元エラーを保ち、queued要求とretryを解放する", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const source = { size: 1, mtimeMs: 1 };
  const original = new Error("async transform failed");
  let fail = true;
  const cache = new ThumbnailCache({
    maxConcurrent: 1,
    async transform({ sourceAbsolutePath, tmpPath }) {
      await writeFile(tmpPath, "temporary thumbnail");
      if (sourceAbsolutePath.endsWith("fail.jpg") && fail) throw original;
    },
  });
  const failed = cache.getOrCreate(cacheDir, "fail", 256, join(baseDir, "fail.jpg"), source);
  const queued = cache.getOrCreate(cacheDir, "next", 256, join(baseDir, "next.jpg"), source);
  await assert.rejects(
    () => failed,
    (error) => error === original,
  );
  const next = await queued;
  assert.ok(existsSync(next.absolutePath));
  assert.ok(readdirSync(cacheDir).every((name) => !name.includes(".tmp-")));

  fail = false;
  const retried = await cache.getOrCreate(cacheDir, "fail", 256, join(baseDir, "fail.jpg"), source);
  assert.ok(existsSync(retried.absolutePath));
});

test("sync throw後もinFlightとslotを解放して後続を生成できる", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const source = { size: 1, mtimeMs: 1 };
  const original = new Error("sync transform failed");
  let fail = true;
  const cache = new ThumbnailCache({
    maxConcurrent: 1,
    transform({ tmpPath }) {
      if (fail) throw original;
      return writeFile(tmpPath, "thumbnail");
    },
  });
  await assert.rejects(
    () => cache.getOrCreate(cacheDir, "sync", 256, join(baseDir, "sync.jpg"), source),
    (error) => error === original,
  );
  fail = false;
  const result = await cache.getOrCreate(cacheDir, "sync", 256, join(baseDir, "sync.jpg"), source);
  assert.ok(existsSync(result.absolutePath));
  assert.ok(readdirSync(cacheDir).every((name) => !name.includes(".tmp-")));
});

test("rename失敗後もtmpを掃除して同じキーを再試行できる", async (t) => {
  const { baseDir, cacheDir } = setup(t);
  const source = { size: 1, mtimeMs: 1 };
  const original = new Error("rename failed");
  let fail = true;
  const cache = new ThumbnailCache({
    maxConcurrent: 1,
    async transform({ tmpPath }) {
      await writeFile(tmpPath, "thumbnail");
    },
    async rename(oldPath, newPath) {
      if (fail) throw original;
      await rename(oldPath, newPath);
    },
  });
  await assert.rejects(
    () => cache.getOrCreate(cacheDir, "rename", 256, join(baseDir, "rename.jpg"), source),
    (error) => error === original,
  );
  assert.ok(readdirSync(cacheDir).every((name) => !name.includes(".tmp-")));
  fail = false;
  const result = await cache.getOrCreate(
    cacheDir,
    "rename",
    256,
    join(baseDir, "rename.jpg"),
    source,
  );
  assert.ok(existsSync(result.absolutePath));
});
