import assert from "node:assert/strict";
import { posix, win32 } from "node:path";
import { test } from "node:test";
import { isPathWithin } from "../../src/adapters/real/paths.ts";

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
