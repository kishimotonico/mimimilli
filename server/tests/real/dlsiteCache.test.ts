import assert from "node:assert/strict";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { Database } from "bun:sqlite";
import { test } from "node:test";
import {
  DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES,
  DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES,
  DEFAULT_DLSITE_CACHE_TTLS_MS,
  DlsiteCache,
  normalizeDlsiteProductCode,
  resolveDlsiteCacheConfig,
  validateDlsiteHtmlInput,
} from "../../src/adapters/real/dlsiteCache.ts";
import { runDlsiteCacheCli } from "../../src/dlsiteCacheCli.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

const VALID_HTML = '<html><h1 id="work_name">テスト作品</h1></html>';

function createCache(t: { after: (callback: () => void) => void }, now = 1_000) {
  const directory = makeTestDirectory("dlsite-cache");
  t.after(directory.cleanup);
  let clock = now;
  const cache = directory.own(
    new DlsiteCache({
      path: join(directory.path, "dlsite-cache.sqlite"),
      clock: () => clock,
      ttlsMs: { ok: 100, parse_error: 20, not_found: 30, error: 40 },
      maxTransferBytes: 1_000,
      maxExpandedBytes: 1_000,
    }),
  );
  return { cache, directory, setClock: (value: number) => (clock = value) };
}

test("DLsiteキャッシュ: hit/miss、RJ/VJ正規化、gzip BLOBを扱う", (t) => {
  const { cache, directory } = createCache(t);
  assert.deepEqual(cache.resolve({ productCode: "RJ123456" }), {
    kind: "miss",
    reason: "not_cached",
  });
  cache.recordSuccess({
    productCode: " rj123456 ",
    outcome: "ok",
    contentType: "text/html; charset=utf-8",
    html: VALID_HTML,
  });
  const hit = cache.resolve({ productCode: "RJ123456" });
  assert.equal(hit.kind, "html");
  if (hit.kind === "html") {
    assert.equal(hit.html, VALID_HTML);
    assert.equal(hit.outcome, "ok");
  }

  const sqlite = new Database(join(directory.path, "dlsite-cache.sqlite"), { readonly: true });
  const row = sqlite.query("SELECT html_gzip FROM dlsite_html_snapshots").get() as {
    html_gzip: Uint8Array;
  };
  sqlite.close();
  assert.notDeepEqual(Buffer.from(row.html_gzip), Buffer.from(VALID_HTML));
  assert.equal(normalizeDlsiteProductCode("vj123456").store, "pro");
  assert.throws(() => normalizeDlsiteProductCode("RJ123"), /形式が不正/);
});

test("DLsiteキャッシュ: TTL境界とoutcome別TTLでは期限切れを返さない", (t) => {
  const { cache, setClock } = createCache(t);
  cache.recordSuccess({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(1_099);
  assert.equal(cache.resolve({ productCode: "RJ123456" }).kind, "html");
  setClock(1_100);
  assert.deepEqual(cache.resolve({ productCode: "RJ123456" }), {
    kind: "miss",
    reason: "ttl_expired",
  });

  setClock(2_000);
  cache.recordSuccess({
    productCode: "RJ123457",
    outcome: "parse_error",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(2_019);
  const parseError = cache.resolve({ productCode: "RJ123457" });
  assert.equal(parseError.kind, "html");
  if (parseError.kind === "html") {
    assert.equal(parseError.outcome, "parse_error");
    assert.equal(parseError.html, VALID_HTML);
  }
  cache.recordFailure({ productCode: "RJ123458", outcome: "not_found" });
  cache.recordFailure({ productCode: "RJ123459", outcome: "error" });
  setClock(2_021);
  assert.deepEqual(cache.resolve({ productCode: "RJ123457" }), {
    kind: "miss",
    reason: "ttl_expired",
  });
  const notFound = cache.resolve({ productCode: "RJ123458" });
  assert.equal(notFound.kind, "failure");
  if (notFound.kind === "failure") assert.equal(notFound.outcome, "not_found");
  const error = cache.resolve({ productCode: "RJ123459" });
  assert.equal(error.kind, "failure");
  if (error.kind === "failure") assert.equal(error.outcome, "error");
  setClock(2_059);
  assert.deepEqual(cache.resolve({ productCode: "RJ123459" }), {
    kind: "miss",
    reason: "not_cached",
  });
});

test("DLsiteキャッシュ: exportHtmlはTTL切れでもsnapshotを読み出す", (t) => {
  const { cache, setClock } = createCache(t);
  cache.recordSuccess({
    productCode: "RJ123456",
    outcome: "parse_error",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(1_021);
  assert.deepEqual(cache.resolve({ productCode: "RJ123456" }), {
    kind: "miss",
    reason: "ttl_expired",
  });
  assert.equal(cache.exportHtml({ productCode: "RJ123456" }), VALID_HTML);
});

test("DLsiteキャッシュ: 成功記録は既存の失敗記録を消す", (t) => {
  const { cache, setClock } = createCache(t);
  cache.recordFailure({ productCode: "RJ123456", outcome: "error" });
  assert.equal(cache.resolve({ productCode: "RJ123456" }).kind, "failure");
  setClock(1_001);
  cache.recordSuccess({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  assert.equal(cache.resolve({ productCode: "RJ123456" }).kind, "html");
});

test("DLsiteキャッシュ: 失敗記録はHTML snapshotを消さずDBに残す", (t) => {
  const { cache, directory, setClock } = createCache(t);
  cache.recordSuccess({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(1_101); // ok TTL(100)超過
  cache.recordFailure({ productCode: "RJ123456", outcome: "error" });
  const resolved = cache.resolve({ productCode: "RJ123456" });
  assert.equal(resolved.kind, "failure");

  const sqlite = new Database(join(directory.path, "dlsite-cache.sqlite"), { readonly: true });
  const row = sqlite
    .query("SELECT outcome FROM dlsite_html_snapshots WHERE product_code = ?")
    .get("RJ123456") as { outcome: string } | null;
  sqlite.close();
  assert.equal(row?.outcome, "ok");
});

test("DLsiteキャッシュ: Content-Typeとサイズ上限で保存前に拒否する", (t) => {
  const { cache } = createCache(t);
  assert.throws(
    () =>
      cache.recordSuccess({
        productCode: "RJ123456",
        outcome: "ok",
        contentType: "application/json",
        html: VALID_HTML,
      }),
    /Content-Type/,
  );
  assert.throws(
    () =>
      cache.recordSuccess({
        productCode: "RJ123456",
        outcome: "ok",
        contentType: "text/html",
        html: "x".repeat(1_001),
      }),
    /展開サイズ/,
  );
  assert.deepEqual(cache.resolve({ productCode: "RJ123456" }), {
    kind: "miss",
    reason: "not_cached",
  });
});

test("DLsiteキャッシュ: 転送上限と展開上限を独立して検証する", () => {
  assert.throws(
    () =>
      validateDlsiteHtmlInput(
        { contentType: "text/html", transferSize: 10, expandedSize: 11 },
        1_000,
        10,
      ),
    /展開サイズ/,
  );
  assert.throws(
    () =>
      validateDlsiteHtmlInput(
        { contentType: "text/html", transferSize: 1_001, expandedSize: 10 },
        1_000,
        10_000,
      ),
    /転送サイズ/,
  );
  // 転送を伴わないローカル入力は展開サイズだけで判定する
  validateDlsiteHtmlInput({ contentType: "text/html", expandedSize: 5_000 }, 1_000, 10_000);
});

test("DLsiteキャッシュ: 改ざんされた過大gzip BLOBを展開上限で拒否する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-gzip-limit");
  t.after(directory.cleanup);
  const path = join(directory.path, "cache.sqlite");
  const cache = directory.own(
    new DlsiteCache({ path, maxTransferBytes: 1_000, maxExpandedBytes: 64 }),
  );
  cache.recordSuccess({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });

  const sqlite = new Database(path);
  sqlite
    .query("UPDATE dlsite_html_snapshots SET html_gzip = ?, html_size = ? WHERE product_code = ?")
    .run(gzipSync("x".repeat(128)), 128, "RJ123456");
  sqlite.close();
  assert.throws(() => cache.resolve({ productCode: "RJ123456" }), /gzip展開に失敗/);
});

test("DLsiteキャッシュ: close後に同じDBを開き直してHTMLを読める", (t) => {
  const directory = makeTestDirectory("dlsite-cache-persistence");
  t.after(directory.cleanup);
  const path = join(directory.path, "cache.sqlite");
  const first = new DlsiteCache({ path });
  first.recordSuccess({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  first.close();
  const reopened = directory.own(new DlsiteCache({ path }));
  const hit = reopened.resolve({ productCode: "RJ123456" });
  assert.equal(hit.kind, "html");
  if (hit.kind === "html") assert.equal(hit.html, VALID_HTML);
});

test("DLsiteキャッシュ: fetched_atとTTLの加算が安全な整数を超えると保存しない", (t) => {
  const directory = makeTestDirectory("dlsite-cache-clock-overflow");
  t.after(directory.cleanup);
  const cache = directory.own(
    new DlsiteCache({
      path: join(directory.path, "cache.sqlite"),
      clock: () => Number.MAX_SAFE_INTEGER - 10,
      ttlsMs: { error: 20 },
    }),
  );
  assert.throws(
    () => cache.recordFailure({ productCode: "RJ123456", outcome: "error" }),
    /attempted_at \+ TTL/,
  );
  assert.deepEqual(cache.resolve({ productCode: "RJ123456" }), {
    kind: "miss",
    reason: "not_cached",
  });
});

test("DLsiteキャッシュ: cleanupは期限切れだけを明示的に消し、statusはDB容量を返す", (t) => {
  const { cache, setClock } = createCache(t);
  cache.recordFailure({ productCode: "RJ123456", outcome: "error" });
  setClock(1_041);
  assert.equal(cache.cleanupExpired(), 1);
  assert.deepEqual(cache.status().entries, 0);
  assert.ok(cache.status().bytes > 0);
});

test("DLsiteキャッシュ設定: 環境変数を厳格に解釈する", () => {
  const config = resolveDlsiteCacheConfig("/tmp/default.sqlite", {
    MIMIMILLI_DLSITE_CACHE_DB: "/tmp/override.sqlite",
  });
  assert.equal(config.path, "/tmp/override.sqlite");
  assert.deepEqual(config.ttlsMs, DEFAULT_DLSITE_CACHE_TTLS_MS);
  assert.equal(config.maxTransferBytes, DEFAULT_DLSITE_CACHE_MAX_TRANSFER_BYTES);
  assert.equal(config.maxExpandedBytes, DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES);
  assert.throws(
    () =>
      resolveDlsiteCacheConfig("/tmp/default.sqlite", {
        MIMIMILLI_DLSITE_CACHE_DB: "relative.sqlite",
      }),
    /絶対パス/,
  );
});

test("DLsiteキャッシュCLI: status、import、cleanupと同一キー上書き", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli");
  t.after(directory.cleanup);
  const cachePath = join(directory.path, "cache.sqlite");
  const htmlPath = join(directory.path, "work.html");
  writeFileSync(htmlPath, VALID_HTML);
  const env = { MIMIMILLI_DATA_DIR: directory.path, MIMIMILLI_DLSITE_CACHE_DB: cachePath };
  let now = 10_000;
  const overrides = {
    clock: () => now,
    ttlsMs: { ok: 10, parse_error: 10, not_found: 10, error: 10 },
  };
  assert.deepEqual(
    JSON.parse(
      runDlsiteCacheCli(
        ["import", "--product-code", "rj123456", "--file", htmlPath],
        env,
        overrides,
      ),
    ),
    {
      productCode: "RJ123456",
      outcome: "ok",
    },
  );
  writeFileSync(htmlPath, "<html>broken</html>");
  assert.equal(
    JSON.parse(
      runDlsiteCacheCli(
        ["import", "--product-code", "RJ123456", "--file", htmlPath],
        env,
        overrides,
      ),
    ).outcome,
    "parse_error",
  );
  assert.equal(JSON.parse(runDlsiteCacheCli(["status"], env, overrides)).entries, 1);
  now += 10;
  assert.equal(JSON.parse(runDlsiteCacheCli(["cleanup"], env, overrides)).deleted, 1);
});

test("DLsiteキャッシュCLI: exportで有効なHTML snapshotを書き出す", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export");
  t.after(directory.cleanup);
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  const source = join(directory.path, "work.html");
  writeFileSync(source, VALID_HTML);
  runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", source], env);
  const out = join(directory.path, "exported.html");
  assert.deepEqual(
    JSON.parse(runDlsiteCacheCli(["export", "--product-code", "RJ123456", "--file", out], env)),
    { productCode: "RJ123456", bytes: Buffer.byteLength(VALID_HTML, "utf8") },
  );
  assert.equal(readFileSync(out, "utf8"), VALID_HTML);
});

test("DLsiteキャッシュCLI: exportは未存在・不正product codeで失敗する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export-fail");
  t.after(directory.cleanup);
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  const out = join(directory.path, "exported.html");
  assert.throws(
    () => runDlsiteCacheCli(["export", "--product-code", "RJ123456", "--file", out], env),
    /HTML snapshotがありません/,
  );
  assert.throws(
    () => runDlsiteCacheCli(["export", "--product-code", "INVALID", "--file", out], env),
    /形式が不正/,
  );
});

test("DLsiteキャッシュCLI: exportはTTL切れのsnapshotでも読み出せる", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export-expired");
  t.after(directory.cleanup);
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  const source = join(directory.path, "work.html");
  writeFileSync(source, VALID_HTML);
  let now = 10_000;
  const overrides = {
    clock: () => now,
    ttlsMs: { ok: 10, parse_error: 10, not_found: 10, error: 10 },
  };
  runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", source], env, overrides);
  now += 10;
  const out = join(directory.path, "exported.html");
  assert.deepEqual(
    JSON.parse(
      runDlsiteCacheCli(["export", "--product-code", "RJ123456", "--file", out], env, overrides),
    ),
    { productCode: "RJ123456", bytes: Buffer.byteLength(VALID_HTML, "utf8") },
  );
  assert.equal(readFileSync(out, "utf8"), VALID_HTML);
});

test("DLsiteキャッシュCLI: symlinkを拒否し、magic byteでgzip入力を受け入れる", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-input");
  t.after(directory.cleanup);
  const source = join(directory.path, "source.html");
  const symlink = join(directory.path, "link.html");
  const gzip = join(directory.path, "compressed.html");
  writeFileSync(source, VALID_HTML);
  symlinkSync(source, symlink);
  writeFileSync(gzip, gzipSync(VALID_HTML));
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  assert.throws(
    () => runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", symlink], env),
    /symlink/,
  );
  assert.deepEqual(
    JSON.parse(runDlsiteCacheCli(["import", "--product-code", "RJ123457", "--file", gzip], env)),
    { productCode: "RJ123457", outcome: "ok" },
  );
  assert.equal(readFileSync(source, "utf8"), VALID_HTML);
});

test("DLsiteキャッシュCLI: gzip展開サイズが上限を超えると拒否する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-gzip-limit");
  t.after(directory.cleanup);
  const gzip = join(directory.path, "huge.html");
  writeFileSync(gzip, gzipSync("x".repeat(1_000)));
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  assert.throws(
    () =>
      runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", gzip], env, {
        maxExpandedBytes: 100,
      }),
    /展開サイズ|展開に失敗/,
  );
});

test("DLsiteキャッシュCLI: ディレクトリを一括importし、成功・失敗件数を返す", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-dir");
  t.after(directory.cleanup);
  const sourceDir = join(directory.path, "bulk");
  mkdirSync(sourceDir);
  writeFileSync(join(sourceDir, "RJ123456.html"), VALID_HTML);
  writeFileSync(join(sourceDir, "rj123457.html.gz"), gzipSync("<html>broken</html>"));
  writeFileSync(join(sourceDir, "RJ999.html"), VALID_HTML); // 桁数不足でファイル名からproduct code決定不可
  writeFileSync(join(sourceDir, "readme.txt"), "ignored"); // 対象外拡張子はスキップ
  const nested = join(sourceDir, "nested");
  mkdirSync(nested);
  writeFileSync(join(nested, "RJ000001.html"), VALID_HTML); // 非再帰なので対象外

  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  const result = JSON.parse(runDlsiteCacheCli(["import", "--dir", sourceDir], env)) as {
    succeeded: number;
    failed: number;
    failures: { file: string; error: string }[];
  };
  assert.equal(result.succeeded, 2);
  assert.equal(result.failed, 1);
  assert.equal(result.failures[0]?.file, "RJ999.html");

  const status = JSON.parse(runDlsiteCacheCli(["status"], env)) as { entries: number };
  assert.equal(status.entries, 2);
});

test("DLsiteキャッシュCLI: export --dir と import --dir の往復で全件を復元する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export-dir");
  t.after(directory.cleanup);
  const hugeHtml = `<html><h1 id="work_name">大きい作品</h1><!--${"a".repeat(
    DEFAULT_DLSITE_CACHE_MAX_EXPANDED_BYTES - 1024,
  )}--></html>`;
  const sourceDir = join(directory.path, "source");
  mkdirSync(sourceDir);
  writeFileSync(join(sourceDir, "RJ123456.html"), VALID_HTML);
  writeFileSync(join(sourceDir, "RJ123457.html"), hugeHtml);

  const original = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "original.sqlite"),
  };
  assert.equal(
    JSON.parse(runDlsiteCacheCli(["import", "--dir", sourceDir], original)).succeeded,
    2,
  );

  const archiveDir = join(directory.path, "archive");
  assert.deepEqual(JSON.parse(runDlsiteCacheCli(["export", "--dir", archiveDir], original)), {
    succeeded: 2,
    failed: 0,
    failures: [],
  });
  assert.deepEqual(readdirSync(archiveDir).sort(), ["RJ123456.html.gz", "RJ123457.html.gz"]);
  assert.deepEqual(
    readFileSync(join(archiveDir, "RJ123456.html.gz")).subarray(0, 2),
    Buffer.from([0x1f, 0x8b]),
  );

  const restored = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "restored.sqlite"),
  };
  assert.deepEqual(JSON.parse(runDlsiteCacheCli(["import", "--dir", archiveDir], restored)), {
    succeeded: 2,
    failed: 0,
    failures: [],
  });
  const out = join(directory.path, "roundtrip.html");
  runDlsiteCacheCli(["export", "--product-code", "RJ123456", "--file", out], restored);
  assert.equal(readFileSync(out, "utf8"), VALID_HTML);
  runDlsiteCacheCli(["export", "--product-code", "RJ123457", "--file", out], restored);
  assert.equal(readFileSync(out, "utf8"), hugeHtml);
});

test("DLsiteキャッシュCLI: 展開後が上限内ならgzipが元より大きくてもimportできる", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-incompressible");
  t.after(directory.cleanup);
  const raw = Buffer.from(VALID_HTML);
  const file = join(directory.path, "RJ123456.html.gz");
  // level 0（無圧縮）はgzip枠の分だけ本文より大きくなる。圧縮できないHTMLと同じ形。
  writeFileSync(file, gzipSync(raw, { level: 0 }));
  assert.ok(statSync(file).size > raw.byteLength);
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  const overrides = { maxExpandedBytes: raw.byteLength };
  assert.deepEqual(
    JSON.parse(
      runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", file], env, overrides),
    ),
    { productCode: "RJ123456", outcome: "ok" },
  );
  const out = join(directory.path, "exported.html");
  runDlsiteCacheCli(["export", "--product-code", "RJ123456", "--file", out], env, overrides);
  assert.equal(readFileSync(out, "utf8"), VALID_HTML);
});

test("DLsiteキャッシュCLI: export --dir はTTL切れも書き出し、非空ディレクトリを拒む", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export-dir-guard");
  t.after(directory.cleanup);
  const source = join(directory.path, "work.html");
  writeFileSync(source, VALID_HTML);
  const env = {
    MIMIMILLI_DATA_DIR: directory.path,
    MIMIMILLI_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  let now = 10_000;
  const overrides = {
    clock: () => now,
    ttlsMs: { ok: 10, parse_error: 10, not_found: 10, error: 10 },
  };
  runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", source], env, overrides);
  now += 10;

  const archiveDir = join(directory.path, "archive");
  assert.equal(
    JSON.parse(runDlsiteCacheCli(["export", "--dir", archiveDir], env, overrides)).succeeded,
    1,
  );
  assert.throws(
    () => runDlsiteCacheCli(["export", "--dir", archiveDir], env, overrides),
    /空のディレクトリ/,
  );
});

test("DLsiteキャッシュCLI: export --dir は1件の失敗で全体を止めない", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-export-dir-partial");
  t.after(directory.cleanup);
  const source = join(directory.path, "work.html");
  writeFileSync(source, VALID_HTML);
  const cachePath = join(directory.path, "cache.sqlite");
  const env = { MIMIMILLI_DATA_DIR: directory.path, MIMIMILLI_DLSITE_CACHE_DB: cachePath };
  runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", source], env);

  const sqlite = new Database(cachePath);
  sqlite
    .query(
      `INSERT INTO dlsite_html_snapshots
        (store, product_code, representation, outcome, content_fetched_at,
         content_expires_at, html_gzip, html_size)
       SELECT store, 'RJ12', representation, outcome, content_fetched_at,
         content_expires_at, html_gzip, html_size
       FROM dlsite_html_snapshots`,
    )
    .run();
  sqlite.close();

  const archiveDir = join(directory.path, "archive");
  const result = JSON.parse(runDlsiteCacheCli(["export", "--dir", archiveDir], env)) as {
    succeeded: number;
    failed: number;
    failures: { file: string; error: string }[];
  };
  assert.equal(result.succeeded, 1);
  assert.equal(result.failed, 1);
  assert.equal(result.failures[0]?.file, "RJ12.html.gz");
  assert.deepEqual(readdirSync(archiveDir), ["RJ123456.html.gz"]);
});

test("DLsiteカバーキャッシュ: 正規化URLのhashごとに非圧縮バイト列を保持する", (t) => {
  const { cache } = createCache(t);
  const firstUrl = "https://img.dlsite.jp/modpub/images2/work/a.jpg";
  const changedUrl = "https://img.dlsite.jp/modpub/images2/work/b.jpg";
  const first = new Uint8Array([1, 2, 3]);
  cache.putCover(firstUrl, first, "image/jpeg");
  assert.deepEqual(cache.getCover(firstUrl)?.body, first);
  assert.equal(cache.getCover(changedUrl), null);
  cache.putCover(changedUrl, new Uint8Array([4, 5]), "image/jpeg");
  assert.deepEqual(cache.getCover(changedUrl)?.body, new Uint8Array([4, 5]));
  assert.deepEqual(cache.getCover(firstUrl)?.body, first);
});
