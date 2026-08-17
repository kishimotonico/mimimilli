import assert from "node:assert/strict";
import { posix, win32 } from "node:path";
import { test } from "node:test";
import {
  excludeDescendantPaths,
  likeDescendantsPrefix,
  likeStrictDescendantPrefixSql,
  SQL_LIKE_ESCAPE_CLAUSE,
} from "../../src/adapters/real/paths.ts";
import { isPathWithin } from "../../src/lib/path.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";

test("POSIX パスは名前の前方一致ではなくディレクトリ境界で判定する", () => {
  assert.equal(isPathWithin("/library", "/library", posix), true);
  assert.equal(isPathWithin("/library", "/library/work", posix), true);
  assert.equal(isPathWithin("/library", "/library-other/work", posix), false);
});

test("Windows パスの親子関係をバックスラッシュ境界で判定する", () => {
  assert.equal(isPathWithin("C:\\library", "C:\\library", win32), true);
  assert.equal(isPathWithin("C:\\library", "C:\\library\\genre\\work", win32), true);
  assert.equal(isPathWithin("C:\\library", "C:\\library-other\\work", win32), false);
  assert.equal(isPathWithin("C:\\library", "D:\\library\\work", win32), false);
});

test("LIKE 子孫接頭辞は区切り文字を重ねず、Windows 形式でも境界を保つ", () => {
  assert.equal(likeDescendantsPrefix("/library", posix.sep), "/library/%");
  assert.equal(likeDescendantsPrefix("/library/", posix.sep), "/library/%");
  assert.equal(likeDescendantsPrefix("/library/A_B", posix.sep), "/library/A!_B/%");
  assert.equal(likeDescendantsPrefix("C:\\library", win32.sep), "C:\\library\\%");
  assert.equal(likeDescendantsPrefix("C:\\library\\", win32.sep), "C:\\library\\%");
  assert.equal(likeDescendantsPrefix("D:\\", win32.sep), "D:\\%");
});

test("祖先 LIKE 接頭辞 SQL は Windows 区切りでも子孫判定できる", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const ancestor = "C:\\library";
  const row = db.sqlite
    .query(
      `SELECT
         ? LIKE ${likeStrictDescendantPrefixSql("?")}${SQL_LIKE_ESCAPE_CLAUSE} AS isDescendant,
         ? NOT LIKE ${likeStrictDescendantPrefixSql("?")}${SQL_LIKE_ESCAPE_CLAUSE} AS isNotPrefix`,
    )
    .get(
      "C:\\library\\work",
      ancestor,
      win32.sep,
      ancestor,
      ancestor,
      win32.sep,
      "C:\\library-other\\work",
      ancestor,
      win32.sep,
      ancestor,
      ancestor,
      win32.sep,
    ) as { isDescendant: number; isNotPrefix: number };
  assert.equal(row.isDescendant, 1);
  assert.equal(row.isNotPrefix, 1);
});

// ── excludeDescendantPaths（TASK-62: 祖先除外の線形化） ─────────

test("祖先除外: 候補0件は空を返す", () => {
  assert.deepEqual(excludeDescendantPaths(new Set(), undefined, posix), []);
});

test("祖先除外: 祖先と子孫が混在するとき祖先だけを残す", () => {
  const input = new Set(["/library/work", "/library", "/other"]);
  const result = excludeDescendantPaths(input, undefined, posix);
  assert.deepEqual(new Set(result), new Set(["/library", "/other"]));
});

test("祖先除外: 深い子孫が浅い祖先より先に登録されても祖先だけを残す", () => {
  // 深さ昇順に処理するため Set の挿入順には依存しない
  const input = new Set(["/a/b/c", "/a/b", "/a"]);
  assert.deepEqual(excludeDescendantPaths(input, undefined, posix), ["/a"]);
});

test("祖先除外: 兄弟パスと名前の前方一致だけのパスは残す", () => {
  // "/a/bc" は "/a/b" の子孫ではない（ディレクトリ境界で判定する）
  const input = new Set(["/a/b", "/a/bc", "/a/c"]);
  const result = excludeDescendantPaths(input, undefined, posix);
  assert.deepEqual(new Set(result), input);
});

test("祖先除外: 同一パスは1件として扱う", () => {
  assert.deepEqual(excludeDescendantPaths(new Set(["/a", "/a"]), undefined, posix), ["/a"]);
});

test("祖先除外: Windows パスもバックスラッシュ境界で判定する", () => {
  const input = new Set(["C:\\lib\\work", "C:\\lib", "C:\\lib-other"]);
  const result = excludeDescendantPaths(input, undefined, win32);
  assert.deepEqual(new Set(result), new Set(["C:\\lib", "C:\\lib-other"]));
});

test("祖先除外: 比較回数は全ペア比較 O(N²) を大きく下回る", () => {
  // 深さ3の候補2,000件。全ペア比較なら約400万回のところ、
  // 深さ比例の探索なら数万回以下に収まるはず。
  const input = new Set<string>();
  for (let i = 0; i < 2000; i++) input.add(`/root/g${i % 20}/work-${i}`);
  const stats = { ancestorLookups: 0 };
  excludeDescendantPaths(input, stats, posix);
  assert.ok(
    stats.ancestorLookups < 100_000,
    `ancestorLookups=${stats.ancestorLookups} が線形水準を超過`,
  );
});
