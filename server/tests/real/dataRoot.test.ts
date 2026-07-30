import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDataPaths } from "../../src/adapters/real/dataRoot.ts";

test("MIMIMILLI_DATA_DIRを絶対化し、DBとcacheを用途別に配置する", () => {
  const paths = resolveDataPaths({ MIMIMILLI_DATA_DIR: "./custom-data" }, "linux", "/home/test");
  assert.ok(paths.root.endsWith("/custom-data"));
  assert.equal(paths.catalogDb, `${paths.root}/db/catalog.sqlite`);
  assert.equal(paths.userDb, `${paths.root}/db/user.sqlite`);
  assert.equal(paths.dlsiteCacheDb, `${paths.root}/db/dlsite-cache.sqlite`);
  assert.equal(paths.thumbnailCache, `${paths.root}/cache/thumbnails`);
});

test("Linux既定はXDG_DATA_HOME、Windows既定はLOCALAPPDATAを使う", () => {
  assert.equal(
    resolveDataPaths({ XDG_DATA_HOME: "/xdg" }, "linux", "/home/test").root,
    "/xdg/mimimilli",
  );
  assert.equal(
    resolveDataPaths(
      { LOCALAPPDATA: "C:\\Users\\test\\AppData\\Local" },
      "win32",
      "C:\\Users\\test",
    ).root,
    "C:\\Users\\test\\AppData\\Local\\Mimimilli",
  );
});
