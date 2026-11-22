import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyDlsiteState, type WorkSummary } from "@mimimilli/shared";
import { buildGroupValues } from "../../src/core/groupValues.ts";
import { nts } from "../helpers/tag.ts";

function work(id: string, tags: string[], patch: Partial<WorkSummary> = {}): WorkSummary {
  return {
    id,
    title: id,
    cover: null,
    status: "ok",
    physicalPath: `/lib/${id}`,
    totalDurationSec: 0,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: nts(tags),
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    ...patch,
  };
}

const cv = { kind: "prefix", prefix: "cv" } as const;

const works = [
  work("w1", ["cv/いちご", "cv/Banana"], {
    totalDurationSec: 100,
    addedAt: "2026-03-01T00:00:00.000Z",
    lastPlayedAt: "2026-05-01T00:00:00.000Z",
  }),
  work("w2", ["cv/いちご"], {
    totalDurationSec: 50,
    addedAt: "2026-01-01T00:00:00.000Z",
    lastPlayedAt: "2026-06-01T00:00:00.000Z",
  }),
  work("w3", ["cv/うめ"], { totalDurationSec: 500, addedAt: "2026-02-01T00:00:00.000Z" }),
  work("w4", ["cv/イチゴ"], { totalDurationSec: 10, addedAt: "2025-12-01T00:00:00.000Z" }),
];

const order = (groupSort: Parameters<typeof buildGroupValues>[2]) =>
  buildGroupValues(cv, works, groupSort).map((item) => item.value);

test("値一覧の8種の並びと同順位", () => {
  // sortKey: いちご・イチゴ=いちご、banana、うめ。同じ読みは値の UTF-8 バイト順（イチゴ < いちご ではなく いちご < イチゴ）
  assert.deepEqual(order("count-desc"), ["いちご", "Banana", "イチゴ", "うめ"]);
  assert.deepEqual(order("count-asc"), ["Banana", "イチゴ", "うめ", "いちご"]);
  assert.deepEqual(order("name-asc"), ["Banana", "いちご", "イチゴ", "うめ"]);
  assert.deepEqual(order("name-desc"), ["うめ", "イチゴ", "いちご", "Banana"]);
  assert.deepEqual(order("duration-desc"), ["うめ", "いちご", "Banana", "イチゴ"]);
  assert.deepEqual(order("duration-asc"), ["イチゴ", "Banana", "いちご", "うめ"]);
  assert.deepEqual(order("added-desc"), ["Banana", "いちご", "うめ", "イチゴ"]);
  assert.deepEqual(order("last-played"), ["いちご", "Banana", "イチゴ", "うめ"]);
});

test("値ごとの読み・最新追加・最新再生を返す。再生のない値は null", () => {
  const items = buildGroupValues(cv, works, "name-asc");
  const byValue = new Map(items.map((item) => [item.value, item]));
  assert.equal(byValue.get("いちご")?.sortKey, "いちご");
  assert.equal(byValue.get("イチゴ")?.sortKey, "いちご");
  assert.equal(byValue.get("Banana")?.sortKey, "banana");
  assert.equal(byValue.get("いちご")?.lastAddedAt, "2026-03-01T00:00:00.000Z");
  assert.equal(byValue.get("いちご")?.lastPlayedAt, "2026-06-01T00:00:00.000Z");
  assert.equal(byValue.get("うめ")?.lastPlayedAt, null);
});

test("追加年別の読みは年そのもので、名前の降順は新しい年が先", () => {
  const items = buildGroupValues({ kind: "addedYear" }, works, "name-desc");
  assert.deepEqual(
    items.map((item) => [item.value, item.sortKey]),
    [
      ["2026", "2026"],
      ["2025", "2025"],
    ],
  );
});

test("階層の深いタグは、prefix では最初の / より後ろ全体が1つの値になる", () => {
  const deep = [
    work("d1", ["hoge/fuga/piyo/aaa/bbb"]),
    work("d2", ["hoge/fuga/piyo/aaa/bbb", "hoge/fuga/ccc"]),
  ];
  assert.deepEqual(
    buildGroupValues({ kind: "prefix", prefix: "hoge" }, deep, "count-desc").map((item) => [
      item.value,
      item.count,
    ]),
    [
      ["fuga/piyo/aaa/bbb", 2],
      ["fuga/ccc", 1],
    ],
  );
  assert.deepEqual(
    buildGroupValues({ kind: "tag" }, deep, "name-asc").map((item) => item.value),
    ["hoge/fuga/ccc", "hoge/fuga/piyo/aaa/bbb"],
  );
});
