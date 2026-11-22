import assert from "node:assert/strict";
import { test } from "node:test";
import { HTTPException } from "hono/http-exception";
import type { Condition, GroupBy } from "@mimimilli/shared";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { buildEffectiveCondition, matchCondition } from "../../src/core/condition.ts";
import {
  parseSmartFolderGroupsRequest,
  parseSmartFolderWorksRequest,
  queryFolderGroups,
  queryFolderWorks,
} from "../../src/routes/smartFolderQuery.ts";
import { nts, tf } from "../helpers/tag.ts";
import { folderFixtureWork, makeWorkSummary } from "../helpers/workTestUtils.ts";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");

test("buildEffectiveCondition はフォルダー・グループの値・チップ・検索語を1本の and にし、@year を addedYear に写す", () => {
  const folder: Condition = { type: "and", children: [{ type: "bookmarked" }] };
  assert.deepEqual(
    buildEffectiveCondition({
      condition: folder,
      group: { by: { kind: "prefix", prefix: "cv" }, value: "水瀬" },
      tags: tf("asmr", "@year/2025"),
      q: "雨",
    }),
    {
      type: "and",
      children: [
        { type: "bookmarked" },
        { type: "tag", tag: "cv/水瀬" },
        { type: "tag", tag: "asmr" },
        { type: "addedYear", year: "2025" },
        { type: "text", q: "雨" },
      ],
    },
  );
  assert.deepEqual(
    buildEffectiveCondition({
      condition: { type: "and", children: [] },
      group: { by: { kind: "addedYear" }, value: "2024" },
    }),
    { type: "and", children: [{ type: "addedYear", year: "2024" }] },
  );
  assert.deepEqual(
    buildEffectiveCondition({
      condition: { type: "and", children: [] },
      group: { by: { kind: "tag" }, value: "cv/水瀬" },
    }),
    { type: "and", children: [{ type: "tag", tag: "cv/水瀬" }] },
  );
  assert.deepEqual(buildEffectiveCondition({ condition: folder }), folder);
});

test("matchCondition は長さ不明・未再生・基準時刻ちょうどを意味表どおりに扱う", () => {
  const ctx = { now: NOW };
  const unknown = makeWorkSummary({ totalDurationSec: null, lastPlayedAt: null });
  const edge = makeWorkSummary({
    totalDurationSec: 3600,
    lastPlayedAt: new Date(NOW - 7 * 86_400_000).toISOString(),
    addedAt: new Date(NOW - 30 * 86_400_000).toISOString(),
  });
  const lte: Condition = { type: "duration", op: "lte", sec: 3600 };
  assert.equal(matchCondition(lte, unknown, ctx), false);
  assert.equal(matchCondition({ type: "not", child: lte }, unknown, ctx), true);
  assert.equal(matchCondition(lte, edge, ctx), true);
  assert.equal(matchCondition({ type: "played" }, unknown, ctx), false);
  assert.equal(matchCondition({ type: "played", withinDays: 7 }, edge, ctx), true);
  assert.equal(matchCondition({ type: "played", withinDays: 7 }, unknown, ctx), false);
  assert.equal(matchCondition({ type: "added", withinDays: 30 }, edge, ctx), true);
  assert.equal(matchCondition({ type: "added", withinDays: 29 }, edge, ctx), false);
  assert.equal(matchCondition({ type: "or", children: [] }, edge, ctx), false);
  assert.equal(matchCondition({ type: "and", children: [] }, edge, ctx), true);
});

function adapterWithWorks() {
  return createFixtureAdapter({
    works: [
      folderFixtureWork(
        makeWorkSummary({ id: "w1", title: "一", tags: nts(["cv/a"]), bookmarked: true }),
      ),
      folderFixtureWork(makeWorkSummary({ id: "w2", title: "二", tags: nts(["cv/b"]) })),
    ],
  });
}

test("要求の検証: sort=random で seed が無い・tagOp を送る要求は弾く", () => {
  const status = (fn: () => unknown): number | undefined => {
    try {
      fn();
    } catch (error) {
      return error instanceof HTTPException ? error.status : undefined;
    }
    return undefined;
  };
  assert.equal(
    status(() => parseSmartFolderWorksRequest({ sort: "random", tags: [] })),
    400,
  );
  assert.equal(
    status(() => parseSmartFolderWorksRequest({ sort: "added-desc", tags: [], tagOp: "OR" })),
    400,
  );
  assert.equal(
    status(() => parseSmartFolderWorksRequest({ tags: [] })),
    400,
  );
  assert.equal(
    status(() => parseSmartFolderWorksRequest({ sort: "random", seed: "7", tags: [] })),
    undefined,
  );
  assert.equal(
    status(() => parseSmartFolderGroupsRequest({ groupBy: { kind: "tag" }, tagOp: "OR" })),
    400,
  );
});

test("queryFolderWorks / queryFolderGroups は条件・グループの値・チップを木にして評価し、seed を載せない", async () => {
  const adapter = adapterWithWorks();
  const folder = {
    condition: { type: "and", children: [] } as Condition,
    groupBy: { kind: "prefix", prefix: "cv" } as const,
  };
  const page = await queryFolderWorks(
    adapter,
    folder,
    parseSmartFolderWorksRequest({ sort: "random", seed: "5", group: "a", tags: [] }),
  );
  assert.deepEqual(
    page.items.map((item) => item.id),
    ["w1"],
  );
  assert.equal(page.seed, undefined);

  const groups = await queryFolderGroups(
    adapter,
    folder,
    parseSmartFolderGroupsRequest({ groupBy: { kind: "prefix", prefix: "cv" } }),
  );
  assert.deepEqual(groups.map((g) => [g.value, g.count]).sort(), [
    ["a", 1],
    ["b", 1],
  ]);

  await assert.rejects(
    queryFolderWorks(
      adapter,
      { condition: folder.condition, groupBy: null },
      parseSmartFolderWorksRequest({ sort: "id-asc", group: "a", tags: [] }),
    ),
    HTTPException,
  );
});

test("グループの値は正規化し、不正なら 400 にする", async () => {
  const adapter = adapterWithWorks();
  const request = parseSmartFolderWorksRequest({ sort: "id-asc", group: "A", tags: [] });
  const cv = {
    condition: { type: "and", children: [] } as Condition,
    groupBy: { kind: "prefix", prefix: "cv" } as const,
  };
  // 値の NFKC 正規化・trim はタグと同じ（"ａ" は全角で、正規形の "a" と一致する）
  const page = await queryFolderWorks(adapter, cv, { ...request, group: " a " });
  assert.deepEqual(
    page.items.map((item) => item.id),
    ["w1"],
  );

  const rejected = async (
    folder: typeof cv | { condition: Condition; groupBy: GroupBy },
    group: string,
  ) => {
    await assert.rejects(
      queryFolderWorks(adapter, folder, { ...request, group }),
      (error) => error instanceof HTTPException && error.status === 400,
    );
  };
  await rejected(cv, "   ");
  await rejected({ condition: cv.condition, groupBy: { kind: "tag" } }, "@year/2025");
  await rejected({ condition: cv.condition, groupBy: { kind: "tag" } }, "");
  await rejected({ condition: cv.condition, groupBy: { kind: "addedYear" } }, "20x5");
  await rejected({ condition: cv.condition, groupBy: { kind: "addedYear" } }, "25");
  const year = await queryFolderWorks(
    adapter,
    { condition: cv.condition, groupBy: { kind: "addedYear" } },
    { ...request, group: "2026" },
  );
  assert.equal(year.total, 2);
});
