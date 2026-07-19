import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareJapaneseSortKeys,
  japaneseSortKey,
  stableRandomSortKey,
} from "../src/core/japaneseSortKey.ts";

test("日本語キーはNFKC、カタカナ折りたたみ、Unicode lowercaseを順に適用する", () => {
  assert.equal(japaneseSortKey("ＡＢＣ カタカナ É"), japaneseSortKey("abc かたかな E\u0301"));
  assert.equal(japaneseSortKey("ヴォイス"), "ゔぉいす");
});

test("日本語キーはSQLite BINARYと同じUTF-8バイト順で比較する", () => {
  const values = ["睡眠用", "作業用", "Ａlpha", "alpha"];
  const sorted = [...values].sort(
    (a, b) => compareJapaneseSortKeys(a, b) || (a < b ? -1 : a > b ? 1 : 0),
  );
  assert.deepEqual(sorted, ["alpha", "Ａlpha", "作業用", "睡眠用"]);
});

test("randomキーは同じseedとIDから同じ値を返し、seedで変化する", () => {
  assert.equal(stableRandomSortKey(123, "work-a"), stableRandomSortKey(123, "work-a"));
  assert.notEqual(stableRandomSortKey(123, "work-a"), stableRandomSortKey(124, "work-a"));
});
