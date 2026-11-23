import assert from "node:assert/strict";
import { test } from "node:test";
import { sortByRandomOrder } from "../../src/core/randomOrder.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import type { Condition } from "@mimimilli/shared";
import { createWorkRepos, makeWork, upsertTestWork } from "../helpers/workTestUtils.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";

const and = (): Condition => ({ type: "and", children: [] });
const ctx = { now: Date.parse("2026-06-15T12:00:00.000Z") };

function seedWorks(count: number) {
  const scope = makeTestScope();
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  db.sqlite.transaction(() => {
    for (let i = 0; i < count; i++) {
      const id = `RJ${500000 + i}`;
      upsertTestWork(
        catalog,
        user,
        makeWork({ id, title: `作品${i}`, physicalPath: `/library/${id}` }),
      );
    }
  })();
  const page = (sort: "random" | "title-asc", seed: number, n: number, limit: number) =>
    query.queryWorksByCondition(
      { condition: and(), sort, seed: sort === "random" ? seed : undefined, page: n, limit },
      "/library",
      ctx,
    );
  return { scope, page };
}

test("real のランダム順はseedで再現し、ページ連結で全件が重複・欠落なく並ぶ", (t) => {
  const total = 300;
  const { scope, page } = seedWorks(total);
  t.after(scope.cleanup);
  const idsOf = (seed: number, n: number) =>
    page("random", seed, n, 100).items.map((work) => work.id);
  const collected = [1, 2, 3].flatMap((n) => idsOf(7, n));
  assert.equal(collected.length, total);
  assert.equal(new Set(collected).size, total);
  const allIds = Array.from({ length: total }, (_, i) => `RJ${500000 + i}`);
  assert.deepEqual(
    collected,
    sortByRandomOrder(allIds, 7, (id) => id),
  );
  assert.deepEqual(idsOf(7, 2), collected.slice(100, 200));
  assert.notDeepEqual(idsOf(8, 1), idsOf(7, 1));
});
