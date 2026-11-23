import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conditionSchema,
  isBookmarkedOnly,
  isHasErrorOnly,
  needsCount,
  showsCount,
  smartFolderGroupsRequestSchema,
  smartFolderSchema,
  smartFolderRestoreSchema,
  smartFolderWorksRequestSchema,
  smartFolderWriteSchema,
  SMART_FOLDER_TEMPLATES,
  type Condition,
} from "@mimimilli/shared";

const tag = (t: string): Condition => ({ type: "tag", tag: t });
const and = (...children: Condition[]): Condition => ({ type: "and", children });
const or = (...children: Condition[]): Condition => ({ type: "or", children });
const not = (child: Condition): Condition => ({ type: "not", child });

function accepted(input: unknown): Condition {
  const parsed = conditionSchema.safeParse(input);
  assert.ok(parsed.success, JSON.stringify(parsed.error?.issues));
  return parsed.data;
}

test("保存できる形: 述語・not(述語)・述語だけの or・not(or) を通す", () => {
  const input = and(
    tag("a"),
    not(tag("b")),
    or(tag("c"), { type: "hasPrefix", prefix: "cv" }),
    not(or(tag("d"), tag("e"))),
  );
  assert.deepEqual(accepted(input), input);
  assert.deepEqual(accepted(and()), and());
});

test("保存できる形でないものを弾く", () => {
  for (const bad of [
    tag("a"),
    or(tag("a")),
    and(or()),
    and(not(or())),
    and(and(tag("a"))),
    and(not(not(tag("a")))),
    and(or(or(tag("a"), tag("b")))),
    and(or(not(tag("a")), tag("b"))),
    and({ type: "duration", op: "gte", sec: -1 }),
    and({ type: "addedYear", year: "25" }),
  ]) {
    assert.equal(conditionSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("正規化: ルートの and は畳まず、子1つの or を畳む", () => {
  assert.deepEqual(accepted(and(tag("a"))), and(tag("a")));
  assert.deepEqual(accepted(and(or(tag("a")))), and(tag("a")));
  assert.deepEqual(accepted(and(not(or(tag("a"))))), and(not(tag("a"))));
});

test("正規化: キー順を無視した構造一致で同じ親の重複を落とす", () => {
  const dup = accepted(
    and(
      { type: "duration", op: "gte", sec: 60 },
      { sec: 60, op: "gte", type: "duration" } as Condition,
      or(tag("a"), tag("b")),
      or(tag("a"), tag("b")),
    ),
  );
  assert.deepEqual(dup, and({ type: "duration", op: "gte", sec: 60 }, or(tag("a"), tag("b"))));
  assert.deepEqual(accepted(and(or(tag("a"), tag("a")))), and(tag("a")));
  assert.deepEqual(accepted(and(tag("a"), not(tag("a")))), and(tag("a"), not(tag("a"))));
});

test("正規化: タグは prefix を小文字化し trim する。hasPrefix も同様", () => {
  assert.deepEqual(
    accepted(and(tag(" CV/ 水瀬 "), { type: "hasPrefix", prefix: " CV " })),
    and(tag("cv/水瀬"), { type: "hasPrefix", prefix: "cv" }),
  );
  assert.equal(conditionSchema.safeParse(and(tag("@year/2025"))).success, false);
});

test("条件の形の判定", () => {
  assert.ok(isBookmarkedOnly(and({ type: "bookmarked" })));
  assert.ok(!isBookmarkedOnly(and({ type: "bookmarked" }, tag("a"))));
  assert.ok(!isBookmarkedOnly(and(not({ type: "bookmarked" }))));
  assert.ok(isHasErrorOnly(and({ type: "hasError" })));
  assert.ok(!isHasErrorOnly(and()));
  assert.ok(!isHasErrorOnly({ type: "hasError" }));
});

test("件数: 条件が空・グループ分けありは出さず、hasError だけは隠す判定に数える", () => {
  const byId = (id: string) => SMART_FOLDER_TEMPLATES.find((t) => t.id === id)!;
  const shown = SMART_FOLDER_TEMPLATES.filter(showsCount).map((t) => t.id);
  assert.deepEqual(shown, ["recent", "added", "fav", "error"]);
  assert.ok(needsCount(byId("error")));
  assert.ok(!needsCount(byId("all")) && !needsCount(byId("by-cv")));
  assert.ok(needsCount({ condition: and({ type: "hasError" }), groupBy: { kind: "tag" } }));
  assert.ok(!showsCount({ condition: and({ type: "hasError" }), groupBy: { kind: "tag" } }));
});

test("既定テンプレート: 13本・初回11本・固定IDで、条件は保存できる形", () => {
  assert.equal(SMART_FOLDER_TEMPLATES.length, 13);
  assert.equal(SMART_FOLDER_TEMPLATES.filter((t) => t.seeded).length, 11);
  assert.equal(new Set(SMART_FOLDER_TEMPLATES.map((t) => t.id)).size, 13);
  assert.deepEqual(
    SMART_FOLDER_TEMPLATES.filter((t) => !t.seeded).map((t) => t.id),
    ["by-series", "by-rating"],
  );
  for (const t of SMART_FOLDER_TEMPLATES) {
    const parsed = smartFolderWriteSchema.safeParse({
      name: t.name,
      condition: t.condition,
      sort: t.sort,
      groupBy: t.groupBy,
      groupSort: t.groupSort,
    });
    assert.ok(parsed.success, t.id);
    assert.deepEqual(parsed.data.condition, t.condition);
  }
  const all = SMART_FOLDER_TEMPLATES[0]!;
  assert.deepEqual([all.id, all.sort, all.groupBy], ["all", "added-desc", null]);
});

test("既定テンプレートの値の並び: 追加年別は名前の降順、ほかのグループ分けは件数の多い順、シリーズ別の作品はタイトル順", () => {
  const byId = (id: string) => SMART_FOLDER_TEMPLATES.find((t) => t.id === id)!;
  for (const t of SMART_FOLDER_TEMPLATES) {
    const expected = t.groupBy === null ? null : t.id === "by-year" ? "name-desc" : "count-desc";
    assert.equal(t.groupSort, expected, t.id);
  }
  assert.equal(byId("by-series").sort, "title-asc");
  assert.equal(byId("by-cv").sort, null);
});

test("作品一覧の要求: sort 必須、random は seed 必須、契約にないキーは受け付けない", () => {
  const ok = smartFolderWorksRequestSchema.safeParse({ sort: "title-asc", tags: [] });
  assert.ok(ok.success);
  assert.equal(smartFolderWorksRequestSchema.safeParse({ tags: [] }).success, false);
  assert.equal(
    smartFolderWorksRequestSchema.safeParse({ sort: "random", tags: [] }).success,
    false,
  );
  assert.ok(
    smartFolderWorksRequestSchema.safeParse({ sort: "random", seed: "1", tags: [] }).success,
  );
  for (const tagMode of ["OR", "AND"]) {
    assert.equal(
      smartFolderWorksRequestSchema.safeParse({ sort: "added-desc", tags: [], tagMode }).success,
      false,
    );
  }
  assert.equal(
    smartFolderGroupsRequestSchema.safeParse({
      groupBy: { kind: "tag" },
      tags: [],
      tagMode: "OR",
    }).success,
    false,
  );
});

test("知らないキーを弾く", () => {
  const unknownKeys = [
    and({ type: "played", withinDay: 7 } as unknown as Condition),
    and({ type: "tag", tag: "a", negate: true } as unknown as Condition),
    { type: "and", children: [], extra: 1 },
  ];
  for (const bad of unknownKeys) {
    assert.equal(conditionSchema.safeParse(bad).success, false, JSON.stringify(bad));
  }
});

test("text は trim し、空は弾き、trim 後で重複を落とす", () => {
  assert.equal(conditionSchema.safeParse(and({ type: "text", q: "  " })).success, false);
  assert.deepEqual(
    accepted(and({ type: "text", q: " 雨 " }, { type: "text", q: "雨" })),
    and({ type: "text", q: "雨" }),
  );
});

test("復元できる ID は sf-<uuid> と all 以外のテンプレート ID", () => {
  const base = {
    name: "x",
    condition: and(),
    sort: null,
    groupBy: null,
    groupSort: null,
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const ok = (id: string) => smartFolderRestoreSchema.safeParse({ ...base, id }).success;
  assert.ok(ok("sf-123e4567-e89b-42d3-a456-426614174000"));
  assert.ok(ok("by-cv"));
  assert.ok(!ok("all"));
  assert.ok(!ok("sf-1"));
  assert.ok(!ok("whatever"));
  assert.ok(!smartFolderRestoreSchema.safeParse({ ...base, id: "by-cv", createdAt: "t" }).success);
});

test("一覧の1行は condition が null だと読めない", () => {
  const row = {
    id: "sf-x",
    name: "n",
    condition: null,
    sort: null,
    groupBy: null,
    groupSort: null,
    position: 0,
    createdAt: "t",
    count: null,
  };
  assert.equal(smartFolderSchema.safeParse(row).success, false);
  assert.ok(smartFolderSchema.safeParse({ ...row, condition: and() }).success);
});

test("withinDays は 36500 日まで", () => {
  for (const type of ["added", "played"] as const) {
    assert.ok(conditionSchema.safeParse(and({ type, withinDays: 36500 })).success);
    assert.ok(!conditionSchema.safeParse(and({ type, withinDays: 36501 })).success);
    assert.ok(!conditionSchema.safeParse(and({ type, withinDays: 1e9 })).success);
  }
});
