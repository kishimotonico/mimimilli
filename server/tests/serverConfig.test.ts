import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { resolveServerConfig } from "../src/serverConfig.ts";

test("resolveServerConfig: MIMIMILLI_ADAPTER 未設定時は real", () => {
  const config = resolveServerConfig({});
  assert.equal(config.adapterKind, "real");
});

test("resolveServerConfig: fixture adapter を解釈する", () => {
  const config = resolveServerConfig({ MIMIMILLI_ADAPTER: "fixture" });
  assert.equal(config.adapterKind, "fixture");
});

test("resolveServerConfig: 不明な MIMIMILLI_ADAPTER は resolveServerConfig で失敗する", () => {
  assert.throws(
    () => resolveServerConfig({ MIMIMILLI_ADAPTER: "invalid-adapter-for-test" }),
    /不明な MIMIMILLI_ADAPTER です: invalid-adapter-for-test/,
  );
});

test("resolveServerConfig: PORT 未設定時は 8080", () => {
  const config = resolveServerConfig({});
  assert.equal(config.port, 8080);
});

test("resolveServerConfig: MOCK_SCENARIO と THUMBNAIL_CACHE_DIR を返す", () => {
  const config = resolveServerConfig({
    MIMIMILLI_MOCK_SCENARIO: "new-work",
    MIMIMILLI_THUMBNAIL_CACHE_DIR: "/tmp/thumbs",
  });
  assert.equal(config.mockScenario, "new-work");
  assert.equal(config.thumbnailCacheDirOverride, "/tmp/thumbs");
});

test("resolveServerConfig: staticDir は未設定なら undefined", () => {
  const config = resolveServerConfig({});
  assert.equal(config.staticDir, undefined);
});

test("resolveServerConfig: staticDir は存在しないディレクトリで失敗する", () => {
  assert.throws(
    () =>
      resolveServerConfig({
        MIMIMILLI_STATIC_DIR: "/tmp/mimimilli-static-missing-dir",
      }),
    /MIMIMILLI_STATIC_DIR で指定されたディレクトリが存在しません/,
  );
});

test("resolveServerConfig: staticDir は index.html が無いディレクトリで失敗する", () => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-static-no-index-"));
  assert.throws(
    () => resolveServerConfig({ MIMIMILLI_STATIC_DIR: dir }),
    /MIMIMILLI_STATIC_DIR に index.html がありません/,
  );
});

test("resolveServerConfig: staticDir は有効なディレクトリを返す", () => {
  const dir = mkdtempSync(join(tmpdir(), "mimimilli-static-"));
  writeFileSync(join(dir, "index.html"), "<!doctype html><html><body>app</body></html>");
  const config = resolveServerConfig({ MIMIMILLI_STATIC_DIR: dir });
  assert.equal(config.staticDir, dir);
});

test("resolveServerConfig: MOCK_DLSITE_FETCH_DELAY_MS は未設定なら0、不正値は失敗する", () => {
  assert.equal(resolveServerConfig({}).dlsiteFetchDelayMs, 0);
  assert.equal(
    resolveServerConfig({ MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS: "1500" }).dlsiteFetchDelayMs,
    1500,
  );
  assert.throws(
    () => resolveServerConfig({ MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS: "abc" }),
    /MIMIMILLI_MOCK_DLSITE_FETCH_DELAY_MS/,
  );
});
