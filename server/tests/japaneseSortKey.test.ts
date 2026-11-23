import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareJapaneseSortKeys,
  japaneseSortKey,
  randomOrderKey,
  sortByRandomOrder,
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
  assert.equal(randomOrderKey(123, "work-a"), randomOrderKey(123, "work-a"));
  assert.notEqual(randomOrderKey(123, "work-a"), randomOrderKey(124, "work-a"));
});

const serialIds = Array.from({ length: 200 }, (_, i) => `RJ${501001 + i}`);
const orderFor = (seed: number, ids = serialIds) => sortByRandomOrder(ids, seed, (id) => id);

test("randomの並びは1000個のseedでほぼ重複しない", () => {
  const orders = new Set(Array.from({ length: 1000 }, (_, seed) => orderFor(seed).join(",")));
  assert.equal(orders.size, 1000);
});

test("連番IDでもseedを変えると先頭がID順から外れる", () => {
  for (let seed = 0; seed < 200; seed++) {
    const head = orderFor(seed).slice(0, 5);
    assert.notEqual(head.join(","), serialIds.slice(0, 5).join(","));
  }
  const firsts = new Set(Array.from({ length: 200 }, (_, seed) => orderFor(seed)[0]));
  assert.ok(firsts.size > 60);
});

test("1万件のキー計算と並べ替えは短時間で終わる", () => {
  const ids = Array.from({ length: 10000 }, (_, i) => crypto.randomUUID() + i);
  const start = performance.now();
  orderFor(42, ids);
  assert.ok(performance.now() - start < 1000);
});
