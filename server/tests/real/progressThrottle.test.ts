import assert from "node:assert/strict";
import { test } from "node:test";
import { createProgressThrottle } from "../../src/adapters/real/progressThrottle.ts";

test("最短間隔未満の連続呼び出しは間引かれる", () => {
  let clock = 0;
  const shouldEmit = createProgressThrottle(200, () => clock);

  assert.equal(shouldEmit(1, 100), true, "最初の呼び出しは常にemit");
  clock += 50;
  assert.equal(shouldEmit(2, 100), false);
  clock += 50;
  assert.equal(shouldEmit(3, 100), false);
});

test("最短間隔以上経過すると再びemitされる", () => {
  let clock = 0;
  const shouldEmit = createProgressThrottle(200, () => clock);

  assert.equal(shouldEmit(1, 100), true);
  clock += 200;
  assert.equal(shouldEmit(2, 100), true);
  clock += 199;
  assert.equal(shouldEmit(3, 100), false);
  clock += 1;
  assert.equal(shouldEmit(4, 100), true);
});

test("processed === total の最終イベントは間引きの対象外で必ずemitされる", () => {
  let clock = 0;
  const shouldEmit = createProgressThrottle(200, () => clock);

  assert.equal(shouldEmit(1, 100), true);
  clock += 1; // 最短間隔未満
  assert.equal(shouldEmit(2, 100), false, "通常の途中イベントは間引かれる");
  assert.equal(shouldEmit(100, 100), true, "最終イベントは間引き条件を無視して必ずemitされる");
});

test("最終イベント直後も時刻が更新され、以後の間引き判定に使われる", () => {
  let clock = 0;
  const shouldEmit = createProgressThrottle(200, () => clock);

  assert.equal(shouldEmit(100, 100), true); // 1フェーズ目の最終イベント
  clock += 1;
  assert.equal(shouldEmit(1, 50), false, "直後の次フェーズ1件目は間引き対象");
  clock += 200;
  assert.equal(shouldEmit(2, 50), true);
});
