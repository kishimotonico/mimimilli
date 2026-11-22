// 条件の木の作品一覧（queryWorksByCondition）の並び・検索語・統計の期待値。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDlsiteState,
  sortIdSchema,
  type Condition,
  type SortId,
  type WorkSummary,
} from "@mimimilli/shared";
import { queryWorksByCondition } from "../../src/core/conditionQuery.ts";
import { compareJapaneseSortKeys } from "../../src/core/japaneseSortKey.ts";
import { nts } from "../helpers/tag.ts";

const NOW = Date.now();
const RECENT = new Date(NOW - 5 * 86400000).toISOString();
const OLD = new Date(NOW - 100 * 86400000).toISOString();
const ALL: Condition = { type: "and", children: [] };

const WORKS: WorkSummary[] = [
  {
    id: "RJ001",
    title: "耳かきASMR",
    cover: null,
    status: "ok",
    physicalPath: "/lib/RJ001",
    totalDurationSec: 1800,
    addedAt: RECENT,
    errorMessage: null,
    urls: [],
    tags: nts(["cv/水瀬なずな", "ASMR", "耳かき"]),
    trackCount: 3,
    bookmarked: true,
    lastPlayedAt: "2025-01-01T00:00:00.000Z",
    dlsite: emptyDlsiteState(),
  },
  {
    id: "RJ002",
    title: "添い寝ボイス",
    cover: null,
    status: "ok",
    physicalPath: "/lib/RJ002",
    totalDurationSec: 3600,
    addedAt: OLD,
    errorMessage: null,
    urls: [],
    tags: nts(["cv/霧島レイ", "添い寝", "ASMR"]),
    trackCount: 2,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
  },
  {
    id: "RJ003",
    title: "催眠音声",
    cover: null,
    status: "missing",
    physicalPath: "/lib/RJ003",
    totalDurationSec: 5400,
    addedAt: OLD,
    errorMessage: null,
    urls: [],
    tags: nts(["cv/水瀬なずな", "催眠"]),
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: "2024-06-01T00:00:00.000Z",
    dlsite: emptyDlsiteState(),
  },
];

function query(
  works: WorkSummary[],
  options: { q?: string; sort?: SortId; page?: number; limit?: number } = {},
) {
  const condition: Condition =
    options.q === undefined ? ALL : { type: "and", children: [{ type: "text", q: options.q }] };
  return queryWorksByCondition(
    works,
    {
      condition,
      sort: options.sort ?? "added-desc",
      page: options.page ?? 1,
      limit: options.limit ?? 100,
    },
    { now: NOW },
  );
}

const ids = (page: { items: WorkSummary[] }) => page.items.map((w) => w.id);

test("q: タイトルの部分一致（小文字化）でフィルタする", () => {
  assert.deepEqual(ids(query(WORKS, { q: "ASMR" })).sort(), ["RJ001", "RJ002"]);
});

test("q: タグの部分一致でもヒットする", () => {
  assert.deepEqual(ids(query(WORKS, { q: "催眠" })), ["RJ003"]);
});

test("q: dlsite.rjCode の部分一致でもヒットする（大文字小文字・RJ接頭辞は無視）", () => {
  const works = WORKS.map((work) =>
    work.id === "RJ002" ? { ...work, dlsite: { ...work.dlsite, rjCode: "RJ01234567" } } : work,
  );
  for (const q of ["RJ01234567", "rj01234567", "01234567", "234567"]) {
    assert.deepEqual(ids(query(works, { q })), ["RJ002"], q);
  }
});

test("q: dlsite.rjCode がVJコードでも部分一致でヒットする（大文字小文字・VJ接頭辞は無視）", () => {
  const works = WORKS.map((work) =>
    work.id === "RJ003" ? { ...work, dlsite: { ...work.dlsite, rjCode: "VJ014780" } } : work,
  );
  for (const q of ["VJ014780", "vj014780", "014780"]) {
    assert.deepEqual(ids(query(works, { q })), ["RJ003"], q);
  }
});

test("sort: title-asc は共通の日本語ソートキーで並び替える", () => {
  const titles = query(WORKS, { sort: "title-asc" }).items.map((w) => w.title);
  assert.deepEqual(titles, [...titles].sort(compareJapaneseSortKeys));
});

test("sort: duration-desc は再生時間の降順", () => {
  assert.deepEqual(ids(query(WORKS, { sort: "duration-desc" })), ["RJ003", "RJ002", "RJ001"]);
});

test("sort: last-played は null を末尾に並べる", () => {
  assert.deepEqual(ids(query(WORKS, { sort: "last-played" })), ["RJ001", "RJ003", "RJ002"]);
});

test("sort: id-asc はID文字列比較", () => {
  assert.deepEqual(ids(query(WORKS, { sort: "id-asc" })), ["RJ001", "RJ002", "RJ003"]);
});

test("ページング: total はフィルタ後・slice前の件数", () => {
  const result = query(WORKS, { sort: "id-asc", page: 2, limit: 1 });
  assert.equal(result.total, 3);
  assert.deepEqual(ids(result), ["RJ002"]);
});

test("stats: 絞り込み後・ページング前の集合から trackCount/durationSec を合算する", () => {
  assert.deepEqual(query(WORKS, { q: "ASMR" }).stats, { trackCount: 5, durationSec: 5400 });
});

test("stats: page/limit で切り出しても全件（絞り込み後）の合計を返す", () => {
  const result = query(WORKS, { sort: "id-asc", page: 1, limit: 1 });
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.stats, { trackCount: 6, durationSec: 10800 });
});

test("stats: totalDurationSec が未知（null）の作品は合計から除外する", () => {
  const works = [...WORKS, { ...WORKS[0]!, id: "RJ004", totalDurationSec: null, trackCount: 10 }];
  const { stats } = query(works);
  assert.equal(stats.trackCount, 3 + 2 + 1 + 10);
  assert.equal(stats.durationSec, 1800 + 3600 + 5400);
});

test("ページング: 全sortでページ連結が全件と一致する（重複・欠落なし）", () => {
  const many: WorkSummary[] = Array.from({ length: 10 }, (_, index) => ({
    ...WORKS[0]!,
    id: `w-${String(index).padStart(2, "0")}`,
    title: `作品${index}`,
    totalDurationSec: index * 300,
    addedAt: new Date(NOW - index * 86400000).toISOString(),
    lastPlayedAt: index % 2 === 0 ? RECENT : null,
  }));
  for (const sort of sortIdSchema.options) {
    const collected: string[] = [];
    for (let page = 1, total = Infinity; (page - 1) * 3 < total; page++) {
      const result = queryWorksByCondition(
        many,
        { condition: ALL, sort, seed: sort === "random" ? 42 : undefined, page, limit: 3 },
        { now: NOW },
      );
      total = result.total;
      collected.push(...ids(result));
    }
    assert.equal(collected.length, many.length, `${sort}: 欠落があります`);
    assert.equal(new Set(collected).size, many.length, `${sort}: 重複があります`);
  }
});
