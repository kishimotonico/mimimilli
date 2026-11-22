import assert from "node:assert/strict";
import { test } from "node:test";
import { HTTPException } from "hono/http-exception";
import {
  buildEffectiveCondition,
  conditionSchema,
  groupChipTag,
  groupPredicate,
  normalizeGroupValue,
  type Condition,
  type GroupBy,
} from "@mimimilli/shared";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { matchCondition } from "../../src/core/condition.ts";
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

test("buildEffectiveCondition は検索語を trim し、空なら text を足さない。保存できる形のままになる", () => {
  const base: Condition = { type: "and", children: [{ type: "bookmarked" }] };
  const trimmed = buildEffectiveCondition({ condition: base, q: "  雨音 \t" });
  assert.deepEqual(trimmed, {
    type: "and",
    children: [{ type: "bookmarked" }, { type: "text", q: "雨音" }],
  });
  assert.deepEqual(conditionSchema.parse(trimmed), trimmed);
  for (const q of ["", "   ", "\u3000 \n"]) {
    const effective = buildEffectiveCondition({ condition: base, q });
    assert.deepEqual(effective, base, JSON.stringify(q));
    assert.ok(conditionSchema.safeParse(effective).success);
  }
});

test("グループの値の検証・述語・チップは1か所の規則で決まる", () => {
  const cv: GroupBy = { kind: "prefix", prefix: "cv" };
  assert.equal(normalizeGroupValue(cv, " 水瀬 "), "水瀬");
  assert.equal(normalizeGroupValue(cv, "  "), null);
  assert.equal(normalizeGroupValue({ kind: "tag" }, "CV/水瀬"), "cv/水瀬");
  assert.equal(normalizeGroupValue({ kind: "tag" }, "@year/2025"), null);
  assert.equal(normalizeGroupValue({ kind: "addedYear" }, "2025"), "2025");
  for (const year of ["25", "20255", "２０２５", "abcd", ""]) {
    assert.equal(normalizeGroupValue({ kind: "addedYear" }, year), null, year);
  }
  assert.deepEqual(groupPredicate(cv, "水瀬"), { type: "tag", tag: "cv/水瀬" });
  assert.deepEqual(groupPredicate({ kind: "addedYear" }, "2025"), {
    type: "addedYear",
    year: "2025",
  });
  assert.equal(groupChipTag(cv, "水瀬"), "cv/水瀬");
  assert.equal(groupChipTag({ kind: "tag" }, "耳かき"), "耳かき");
  assert.equal(groupChipTag({ kind: "addedYear" }, "2025"), "@year/2025");
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

test("要求の検証: sort=random で seed が無い・契約にないキーを送る要求は弾く", () => {
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
    status(() => parseSmartFolderWorksRequest({ sort: "added-desc", tags: [], tagMode: "OR" })),
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
    status(() => parseSmartFolderGroupsRequest({ groupBy: { kind: "tag" }, tagMode: "OR" })),
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

  const groups = await queryFolderGroups(
    adapter,
    folder,
    parseSmartFolderGroupsRequest({
      groupBy: { kind: "prefix", prefix: "cv" },
      groupSort: "count-desc",
    }),
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
  // 値の trim・正規化はタグと同じ（前後に空白のある " a " が、正規形の "a" と一致する）
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
