import assert from "node:assert/strict";
import { test } from "node:test";
import { randomOrderKey, sortByRandomOrder } from "../src/core/randomOrder.ts";

test("randomキーは同じseedとIDから同じ値を返し、seedで変化する", () => {
  assert.equal(randomOrderKey(123, "work-a"), randomOrderKey(123, "work-a"));
  assert.notEqual(randomOrderKey(123, "work-a"), randomOrderKey(124, "work-a"));
});

const serialIds = Array.from({ length: 200 }, (_, i) => `RJ${501001 + i}`);
const orderFor = (seed: number) => sortByRandomOrder(serialIds, seed, (id) => id);

test("randomの並びは1000個のseedでほぼ重複しない", () => {
  const orders = new Set(Array.from({ length: 1000 }, (_, seed) => orderFor(seed).join(",")));
  assert.equal(orders.size, 1000);
});

test("連番IDでもseedを変えると先頭がID順から外れる", () => {
  const idHead = serialIds.slice(0, 5).join(",");
  for (let seed = 0; seed < 200; seed++) {
    assert.notEqual(orderFor(seed).slice(0, 5).join(","), idHead);
  }
  const firsts = new Set(Array.from({ length: 200 }, (_, seed) => orderFor(seed)[0]));
  assert.ok(firsts.size > 60);
});

test("32bitキーが衝突したら入力順によらずIDのバイト順で決まる", () => {
  const a = "00000000-0000-4000-8000-0000d19adc0e";
  const b = "00000000-0000-4000-8000-00005eac1f86";
  assert.equal(randomOrderKey(7, a), randomOrderKey(7, b));
  assert.deepEqual(
    sortByRandomOrder([a, b], 7, (id) => id),
    [b, a],
  );
  assert.deepEqual(
    sortByRandomOrder([b, a], 7, (id) => id),
    [b, a],
  );
});
