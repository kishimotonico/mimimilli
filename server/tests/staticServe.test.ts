import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliCompressSync, brotliDecompressSync, gunzipSync, gzipSync } from "node:zlib";
import { test } from "node:test";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { createStaticMiddleware, resolveStaticDir } from "../src/staticServe.ts";
import { serveFixtureTransport } from "./transport/helpers.ts";

function createStaticFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-static-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><html><body>app</body></html>");
  const assetsDir = join(dir, "assets");
  mkdirSync(assetsDir);
  writeFileSync(join(assetsDir, "app.abc123.js"), "console.log('app');");
  return dir;
}

function createCompressedStaticFixture(): string {
  const dir = createStaticFixture();
  const jsPath = join(dir, "assets", "app.abc123.js");
  const jsContent = "console.log('app');";
  writeFileSync(`${jsPath}.br`, brotliCompressSync(jsContent));
  writeFileSync(`${jsPath}.gz`, gzipSync(jsContent));
  const indexPath = join(dir, "index.html");
  const indexContent = "<!doctype html><html><body>app</body></html>";
  writeFileSync(`${indexPath}.br`, brotliCompressSync(indexContent));
  writeFileSync(`${indexPath}.gz`, gzipSync(indexContent));
  return dir;
}

test("resolveStaticDir は未設定なら undefined を返す", () => {
  assert.equal(resolveStaticDir(undefined), undefined);
  assert.equal(resolveStaticDir(""), undefined);
});

test("resolveStaticDir は存在しないディレクトリで起動エラーにする", () => {
  assert.throws(
    () => resolveStaticDir("/tmp/mimimilli-static-missing-dir"),
    /MIMIMILLI_STATIC_DIR で指定されたディレクトリが存在しません/,
  );
});

test("resolveStaticDir は index.html が無いディレクトリで起動エラーにする", () => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-static-no-index-"));
  assert.throws(() => resolveStaticDir(dir), /MIMIMILLI_STATIC_DIR に index.html がありません/);
});

test("staticDir 未設定時は非API GET が JSON 404 になる", async () => {
  const app = createApp(createFixtureAdapter());
  const res = await app.request("/");
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
});

test("staticDir 設定時は index.html と /assets を配信する", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const indexRes = await app.request("/");
  assert.equal(indexRes.status, 200);
  assert.match(await indexRes.text(), /app/);
  assert.equal(indexRes.headers.get("cache-control"), "no-cache");

  const assetRes = await app.request("/assets/app.abc123.js");
  assert.equal(assetRes.status, 200);
  assert.match(await assetRes.text(), /console\.log\('app'\)/);
  assert.equal(assetRes.headers.get("cache-control"), "public, max-age=31536000, immutable");
});

test("staticDir 設定時は未知パスを index.html へフォールバックする", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/works/RJ501001");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /app/);
  assert.equal(res.headers.get("cache-control"), "no-cache");
});

test("staticDir 設定時は /apifoo を API ではなく SPA フォールバックする", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/apifoo");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /app/);
  assert.equal(res.headers.get("cache-control"), "no-cache");
});

test("staticDir 配下のルート外シンボリックリンクは SPA フォールバックする", async () => {
  const staticDir = createStaticFixture();
  const outsideDir = mkdtempSync(join(tmpdir(), "mimimilli-static-outside-"));
  const secretPath = join(outsideDir, "secret.txt");
  writeFileSync(secretPath, "LEAKED_SECRET");
  symlinkSync(secretPath, join(staticDir, "leak.txt"));

  const app = createApp(createFixtureAdapter(), { staticDir });
  const res = await app.request("/leak.txt");
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /app/);
  assert.doesNotMatch(body, /LEAKED_SECRET/);
});

test("staticDir 設定時も /api は API ハンドラが優先される", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.items));
});

test("staticDir 設定時の非GETは静的配信せず JSON 404 になる", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/", { method: "POST" });
  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.error.code, "not_found");
});

test("Bun.serve 経由でも静的配信と /api が共存する", async (t) => {
  const staticDir = createStaticFixture();
  const { server, baseUrl } = serveFixtureTransport(createFixtureAdapter(), { staticDir });
  t.after(() => server.stop(true));

  const indexRes = await fetch(`${baseUrl}/`);
  assert.equal(indexRes.status, 200);
  assert.match(await indexRes.text(), /app/);

  const spaRes = await fetch(`${baseUrl}/library`);
  assert.equal(spaRes.status, 200);
  assert.match(await spaRes.text(), /app/);

  const apiRes = await fetch(`${baseUrl}/api/works`);
  assert.equal(apiRes.status, 200);
  const body = await apiRes.json();
  assert.ok(body.items.length > 0);
});

test("createStaticMiddleware は /api 配下を通過させる", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter());
  app.use("*", createStaticMiddleware(staticDir));

  const res = await app.request("/api/works");
  assert.equal(res.status, 200);
});

test("Accept-Encoding: br のリクエストは .br を Content-Encoding: br で配信する", async () => {
  const staticDir = createCompressedStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/assets/app.abc123.js", {
    headers: { "Accept-Encoding": "br" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), "br");
  assert.equal(res.headers.get("vary"), "Accept-Encoding");
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  const body = brotliDecompressSync(Buffer.from(await res.arrayBuffer()));
  assert.equal(body.toString("utf8"), "console.log('app');");
});

test("Accept-Encoding: gzip のみのリクエストは .gz を Content-Encoding: gzip で配信する", async () => {
  const staticDir = createCompressedStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/assets/app.abc123.js", {
    headers: { "Accept-Encoding": "gzip" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), "gzip");
  assert.equal(res.headers.get("vary"), "Accept-Encoding");
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  const body = gunzipSync(Buffer.from(await res.arrayBuffer()));
  assert.equal(body.toString("utf8"), "console.log('app');");
});

test("Accept-Encoding 未指定時は素のファイルを配信する", async () => {
  const staticDir = createCompressedStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/assets/app.abc123.js");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), null);
  assert.equal(res.headers.get("vary"), "Accept-Encoding");
  assert.match(res.headers.get("content-type") ?? "", /javascript/);
  assert.equal(await res.text(), "console.log('app');");
});

test("圧縮ファイルが無いアセットは従来通り素のファイルを配信する", async () => {
  const staticDir = createStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/assets/app.abc123.js", {
    headers: { "Accept-Encoding": "br, gzip" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), null);
  assert.equal(await res.text(), "console.log('app');");
});

test("SPA フォールバックも圧縮版 index.html を配信する", async () => {
  const staticDir = createCompressedStaticFixture();
  const app = createApp(createFixtureAdapter(), { staticDir });

  const res = await app.request("/works/RJ501001", {
    headers: { "Accept-Encoding": "br" },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-encoding"), "br");
  assert.equal(res.headers.get("cache-control"), "no-cache");
  const body = brotliDecompressSync(Buffer.from(await res.arrayBuffer()));
  assert.match(body.toString("utf8"), /app/);
});
