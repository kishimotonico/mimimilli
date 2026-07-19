import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { resolveDataPaths, resolveLegacyDbPath } from "../../src/adapters/real/dataRoot.ts";
import { makeTestDirectory } from "../helpers/sampleLibrary.ts";

test("MIMIKAGO_DATA_DIRを絶対化し、DBとcacheを用途別に配置する", () => {
  const paths = resolveDataPaths({ MIMIKAGO_DATA_DIR: "./custom-data" }, "linux", "/home/test");
  assert.ok(paths.root.endsWith("/custom-data"));
  assert.equal(paths.catalogDb, `${paths.root}/db/catalog.sqlite`);
  assert.equal(paths.userDb, `${paths.root}/db/user.sqlite`);
  assert.equal(paths.thumbnailCache, `${paths.root}/cache/thumbnails`);
});

test("Linux既定はXDG_DATA_HOME、Windows既定はLOCALAPPDATAを使う", () => {
  assert.equal(
    resolveDataPaths({ XDG_DATA_HOME: "/xdg" }, "linux", "/home/test").root,
    "/xdg/mimikago",
  );
  assert.equal(
    resolveDataPaths(
      { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      "win32",
      "C:\\Users\\test",
    ).root,
    "C:\\Users\\test\\AppData\\Local\\Mimikago",
  );
});

test("MIMIMILLI_DBの明示パスがなければ、既定の旧DBへフォールバックしない", (t) => {
  const directory = makeTestDirectory("legacy-path");
  t.after(directory.cleanup);
  const defaultPath = join(directory.path, "data", "mimimilli.db");
  mkdirSync(join(directory.path, "data"));
  writeFileSync(defaultPath, "default candidate");

  assert.throws(
    () => resolveLegacyDbPath({ MIMIMILLI_DB: "missing-explicit.sqlite" }, directory.path, "linux"),
    /MIMIMILLI_DBで指定された旧単一DBが存在しません:.*missing-explicit\.sqlite/,
  );
  assert.equal(resolveLegacyDbPath({}, directory.path, "linux"), defaultPath);
});
