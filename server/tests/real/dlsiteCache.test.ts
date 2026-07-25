import assert from "node:assert/strict";
import { readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { Database } from "bun:sqlite";
import { test } from "node:test";
import {
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
  const cache = new DlsiteCache({
    path: join(directory.path, "dlsite-cache.sqlite"),
    clock: () => clock,
    ttlsMs: { ok: 100, parse_error: 20, not_found: 30, error: 40 },
    maxTransferBytes: 1_000,
    maxExpandedBytes: 1_000,
  });
  t.after(() => cache.close());
  return { cache, directory, setClock: (value: number) => (clock = value) };
}

test("DLsiteキャッシュ: hit/miss、RJ/VJ正規化、gzip BLOBを扱う", (t) => {
  const { cache, directory } = createCache(t);
  assert.equal(cache.get({ productCode: "RJ123456" }), null);
  cache.putHtml({
    productCode: " rj123456 ",
    outcome: "ok",
    contentType: "text/html; charset=utf-8",
    html: VALID_HTML,
  });
  const hit = cache.get({ productCode: "RJ123456" });
  assert.equal(hit?.html, VALID_HTML);
  assert.equal(hit?.store, "maniax");
  assert.equal(hit?.outcome, "ok");

  const sqlite = new Database(join(directory.path, "dlsite-cache.sqlite"), { readonly: true });
  const row = sqlite.query("SELECT html_gzip FROM dlsite_cache_entries").get() as {
    html_gzip: Uint8Array;
  };
  sqlite.close();
  assert.notDeepEqual(Buffer.from(row.html_gzip), Buffer.from(VALID_HTML));
  assert.equal(normalizeDlsiteProductCode("vj123456").store, "pro");
  assert.throws(() => normalizeDlsiteProductCode("RJ123"), /形式が不正/);
});

test("DLsiteキャッシュ: TTL境界とoutcome別TTLでは期限切れを返さない", (t) => {
  const { cache, setClock } = createCache(t);
  cache.putHtml({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(1_099);
  assert.equal(cache.get({ productCode: "RJ123456" })?.outcome, "ok");
  setClock(1_100);
  assert.equal(cache.get({ productCode: "RJ123456" }), null);

  setClock(2_000);
  cache.putHtml({
    productCode: "RJ123457",
    outcome: "parse_error",
    contentType: "text/html",
    html: VALID_HTML,
  });
  setClock(2_019);
  const parseError = cache.get({ productCode: "RJ123457" });
  assert.equal(parseError?.outcome, "parse_error");
  assert.equal(parseError?.html, VALID_HTML);
  cache.putNegative({ productCode: "RJ123458", outcome: "not_found" });
  cache.putNegative({ productCode: "RJ123459", outcome: "error" });
  setClock(2_021);
  assert.equal(cache.get({ productCode: "RJ123457" }), null);
  assert.equal(cache.get({ productCode: "RJ123458" })?.outcome, "not_found");
  assert.equal(cache.get({ productCode: "RJ123459" })?.outcome, "error");
  setClock(2_059);
  assert.equal(cache.get({ productCode: "RJ123459" }), null);
});

test("DLsiteキャッシュ: Content-Typeとサイズ上限で保存前に拒否する", (t) => {
  const { cache } = createCache(t);
  assert.throws(
    () =>
      cache.putHtml({
        productCode: "RJ123456",
        outcome: "ok",
        contentType: "application/json",
        html: VALID_HTML,
      }),
    /Content-Type/,
  );
  assert.throws(
    () =>
      cache.putHtml({
        productCode: "RJ123456",
        outcome: "ok",
        contentType: "text/html",
        html: "x".repeat(1_001),
      }),
    /転送サイズ/,
  );
  assert.equal(cache.get({ productCode: "RJ123456" }), null);
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
});

test("DLsiteキャッシュ: 改ざんされた過大gzip BLOBを展開上限で拒否する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-gzip-limit");
  t.after(directory.cleanup);
  const path = join(directory.path, "cache.sqlite");
  const cache = new DlsiteCache({ path, maxTransferBytes: 1_000, maxExpandedBytes: 64 });
  t.after(() => cache.close());
  cache.putHtml({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });

  const sqlite = new Database(path);
  sqlite
    .query("UPDATE dlsite_cache_entries SET html_gzip = ?, html_size = ? WHERE product_code = ?")
    .run(gzipSync("x".repeat(128)), 128, "RJ123456");
  sqlite.close();
  assert.throws(() => cache.get({ productCode: "RJ123456" }), /gzip展開に失敗/);
});

test("DLsiteキャッシュ: close後に同じDBを開き直してHTMLを読める", (t) => {
  const directory = makeTestDirectory("dlsite-cache-persistence");
  t.after(directory.cleanup);
  const path = join(directory.path, "cache.sqlite");
  const first = new DlsiteCache({ path });
  first.putHtml({
    productCode: "RJ123456",
    outcome: "ok",
    contentType: "text/html",
    html: VALID_HTML,
  });
  first.close();
  const reopened = new DlsiteCache({ path });
  t.after(() => reopened.close());
  assert.equal(reopened.get({ productCode: "RJ123456" })?.html, VALID_HTML);
});

test("DLsiteキャッシュ: fetched_atとTTLの加算が安全な整数を超えると保存しない", (t) => {
  const directory = makeTestDirectory("dlsite-cache-clock-overflow");
  t.after(directory.cleanup);
  const cache = new DlsiteCache({
    path: join(directory.path, "cache.sqlite"),
    clock: () => Number.MAX_SAFE_INTEGER - 10,
    ttlsMs: { error: 20 },
  });
  t.after(() => cache.close());
  assert.throws(
    () => cache.putNegative({ productCode: "RJ123456", outcome: "error" }),
    /fetched_at \+ TTL/,
  );
  assert.equal(cache.get({ productCode: "RJ123456" }), null);
});

test("DLsiteキャッシュ: cleanupは期限切れだけを明示的に消し、statusはDB容量を返す", (t) => {
  const { cache, setClock } = createCache(t);
  cache.putNegative({ productCode: "RJ123456", outcome: "error" });
  setClock(1_041);
  assert.equal(cache.cleanupExpired(), 1);
  assert.deepEqual(cache.status().entries, 0);
  assert.ok(cache.status().bytes > 0);
});

test("DLsiteキャッシュ設定: 環境変数を厳格に解釈する", () => {
  const config = resolveDlsiteCacheConfig("/tmp/default.sqlite", {
    MIMIKAGO_DLSITE_CACHE_DB: "/tmp/override.sqlite",
    MIMIKAGO_DLSITE_CACHE_TTL_OK_MS: "42",
  });
  assert.equal(config.path, "/tmp/override.sqlite");
  assert.equal(config.ttlsMs.ok, 42);
  assert.equal(config.ttlsMs.error, DEFAULT_DLSITE_CACHE_TTLS_MS.error);
  assert.throws(
    () =>
      resolveDlsiteCacheConfig("/tmp/default.sqlite", { MIMIKAGO_DLSITE_CACHE_TTL_OK_MS: "1.5" }),
    /整数/,
  );
  assert.throws(
    () =>
      resolveDlsiteCacheConfig("/tmp/default.sqlite", {
        MIMIKAGO_DLSITE_CACHE_DB: "relative.sqlite",
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
  const env = { MIMIKAGO_DATA_DIR: directory.path, MIMIKAGO_DLSITE_CACHE_DB: cachePath };
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

test("DLsiteキャッシュCLI: symlinkとgzip入力を拒否する", (t) => {
  const directory = makeTestDirectory("dlsite-cache-cli-input");
  t.after(directory.cleanup);
  const source = join(directory.path, "source.html");
  const symlink = join(directory.path, "link.html");
  const gzip = join(directory.path, "compressed.html");
  writeFileSync(source, VALID_HTML);
  symlinkSync(source, symlink);
  writeFileSync(gzip, Buffer.from([0x1f, 0x8b, 0x08, 0x00]));
  const env = {
    MIMIKAGO_DATA_DIR: directory.path,
    MIMIKAGO_DLSITE_CACHE_DB: join(directory.path, "cache.sqlite"),
  };
  assert.throws(
    () => runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", symlink], env),
    /symlink/,
  );
  assert.throws(
    () => runDlsiteCacheCli(["import", "--product-code", "RJ123456", "--file", gzip], env),
    /gzip入力/,
  );
  assert.equal(readFileSync(source, "utf8"), VALID_HTML);
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
