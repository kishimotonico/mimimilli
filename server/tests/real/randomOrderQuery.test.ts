import assert from "node:assert/strict";
import { test } from "node:test";
import { openDb } from "../../src/adapters/real/db.ts";
import type { Condition } from "@mimimilli/shared";
import { createWorkRepos, makeWork, upsertTestWork } from "../helpers/workTestUtils.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";

const and = (): Condition => ({ type: "and", children: [] });
const ctx = { now: Date.parse("2026-06-15T12:00:00.000Z") };

test(
  "real のランダム順はseedで再現し、ページ連結で全件が重複・欠落なく並び、1万件でも他の並びと同程度で返る",
  { timeout: 60_000 },
  (t) => {
    const scope = makeTestScope();
    t.after(scope.cleanup);
    const db = scope.own(openDb({ kind: "memory" }));
    const { query, catalog, user } = createWorkRepos(db);
    const total = 10_000;
    db.sqlite.transaction(() => {
      for (let i = 0; i < total; i++) {
        const id = `RJ${String(500000 + i)}`;
        upsertTestWork(
          catalog,
          user,
          makeWork({ id, title: `作品${i}`, physicalPath: `/library/${id}` }),
        );
      }
    })();

    const page = (sort: "random" | "title-asc", seed: number, n: number) =>
      query.queryWorksByCondition(
        {
          condition: and(),
          sort,
          seed: sort === "random" ? seed : undefined,
          page: n,
          limit: 1000,
        },
        "/library",
        ctx,
      );
    const idsOf = (sort: "random" | "title-asc", seed: number, n: number) =>
      page(sort, seed, n).items.map((work) => work.id);

    const collected: string[] = [];
    for (let n = 1; n <= total / 1000; n++) collected.push(...idsOf("random", 7, n));
    assert.equal(collected.length, total);
    assert.equal(new Set(collected).size, total);
    assert.deepEqual(idsOf("random", 7, 3), collected.slice(2000, 3000));
    assert.notDeepEqual(idsOf("random", 8, 1), idsOf("random", 7, 1));

    const time = (sort: "random" | "title-asc") => {
      const start = performance.now();
      for (let n = 1; n <= 5; n++) page(sort, 7, n);
      return (performance.now() - start) / 5;
    };
    time("random");
    time("title-asc");
    const random = time("random");
    const titleAsc = time("title-asc");
    assert.ok(
      random < Math.max(titleAsc * 10, 200),
      `random ${random}ms / title-asc ${titleAsc}ms`,
    );
  },
);
