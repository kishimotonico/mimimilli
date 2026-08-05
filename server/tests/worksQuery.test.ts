import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDlsiteState,
  sortIdSchema,
  type WorkSummary,
  type WorksQuery,
} from "@mimimilli/shared";
import { applyWorksQuery } from "../src/core/worksQuery.ts";
import { compareJapaneseSortKeys } from "../src/core/japaneseSortKey.ts";

const NOW = new Date();
const RECENT = new Date(NOW.getTime() - 5 * 86400000).toISOString(); // 5日前
const OLD = new Date(NOW.getTime() - 100 * 86400000).toISOString(); // 100日前

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
    tags: ["cv/水瀬なずな", "ASMR", "耳かき"],
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
    tags: ["cv/霧島レイ", "添い寝", "ASMR"],
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
    tags: ["cv/水瀬なずな", "催眠"],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: "2024-06-01T00:00:00.000Z",
    dlsite: emptyDlsiteState(),
  },
];

function baseQuery(overrides: Partial<WorksQuery> = {}): WorksQuery {
  return {
    q: "",
    tags: [],
    tagOp: "AND",
    sort: "added-desc",
    ...overrides,
  };
}

test("q: タイトルの部分一致（小文字化）でフィルタする", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ q: "ASMR" }));
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ001", "RJ002"]);
});

test("q: タグの部分一致でもヒットする", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ q: "催眠" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ003"],
  );
});

test("q: dlsite.rjCode の部分一致でもヒットする（大文字小文字・RJ接頭辞は無視）", () => {
  const worksWithRj: WorkSummary[] = WORKS.map((work) =>
    work.id === "RJ002" ? { ...work, dlsite: { ...work.dlsite, rjCode: "RJ01234567" } } : work,
  );

  assert.deepEqual(
    applyWorksQuery(worksWithRj, baseQuery({ q: "RJ01234567" })).items.map((w) => w.id),
    ["RJ002"],
  );
  assert.deepEqual(
    applyWorksQuery(worksWithRj, baseQuery({ q: "rj01234567" })).items.map((w) => w.id),
    ["RJ002"],
  );
  assert.deepEqual(
    applyWorksQuery(worksWithRj, baseQuery({ q: "01234567" })).items.map((w) => w.id),
    ["RJ002"],
  );
  assert.deepEqual(
    applyWorksQuery(worksWithRj, baseQuery({ q: "234567" })).items.map((w) => w.id),
    ["RJ002"],
  );
});

test("q: dlsite.rjCode がVJコードでも部分一致でヒットする（大文字小文字・VJ接頭辞は無視）", () => {
  const worksWithVj: WorkSummary[] = WORKS.map((work) =>
    work.id === "RJ003" ? { ...work, dlsite: { ...work.dlsite, rjCode: "VJ014780" } } : work,
  );

  assert.deepEqual(
    applyWorksQuery(worksWithVj, baseQuery({ q: "VJ014780" })).items.map((w) => w.id),
    ["RJ003"],
  );
  assert.deepEqual(
    applyWorksQuery(worksWithVj, baseQuery({ q: "vj014780" })).items.map((w) => w.id),
    ["RJ003"],
  );
  assert.deepEqual(
    applyWorksQuery(worksWithVj, baseQuery({ q: "014780" })).items.map((w) => w.id),
    ["RJ003"],
  );
});

test("tags: AND は全タグにマッチする作品のみ返す", () => {
  const result = applyWorksQuery(
    WORKS,
    baseQuery({ tags: ["cv/水瀬なずな", "ASMR"], tagOp: "AND" }),
  );
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001"],
  );
});

test("tags: OR はいずれかのタグにマッチする作品を返す", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ tags: ["催眠", "添い寝"], tagOp: "OR" }));
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ002", "RJ003"]);
});

test("tags: 完全一致であり部分文字列ではヒットしない（ADR-0005 決定6）", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ tags: ["cv/なずな"], tagOp: "AND" }));
  assert.equal(result.items.length, 0);
});

test("tags: prefix の大文字小文字は無視して一致する", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ tags: ["CV/水瀬なずな"], tagOp: "AND" }));
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ001", "RJ003"]);
});

test("tags: @year/... 擬似タグは addedAt の年で絞り込む（タグ照合ではない、ADR-0012 §2）", () => {
  const year = RECENT.slice(0, 4);
  const result = applyWorksQuery(WORKS, baseQuery({ tags: [`@year/${year}`] }));
  assert.ok(result.items.length > 0);
  for (const work of result.items) {
    assert.equal(work.addedAt.slice(0, 4), year);
  }
  const none = applyWorksQuery(WORKS, baseQuery({ tags: ["@year/1999"] }));
  assert.equal(none.items.length, 0);
});

test("tags: 実タグと @year/... 擬似タグを同時に指定すると両方AND適用される", () => {
  const year = RECENT.slice(0, 4);
  const result = applyWorksQuery(WORKS, baseQuery({ tags: ["cv/水瀬なずな", `@year/${year}`] }));
  for (const work of result.items) {
    assert.equal(work.addedAt.slice(0, 4), year);
    assert.ok(work.tags.some((tag) => tag.toLowerCase() === "cv/水瀬なずな".toLowerCase()));
  }
});

test("view: fav はブックマーク済みのみ", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "fav" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001"],
  );
});

test("view: unplayed は未再生かつ status=ok のみ", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "unplayed" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ002"],
  );
});

test("view: missing は status=missing のみ", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "missing" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ003"],
  );
});

test("view: recent は lastPlayedAt がある作品のみ", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "recent" }));
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ001", "RJ003"]);
});

test("view: added は30日以内に追加された作品のみ", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "added" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001"],
  );
});

test("view: all は無条件（フィルタなし）", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ view: "all" }));
  assert.equal(result.items.length, 3);
});

test("sort: title-asc は共通の日本語ソートキーで並び替える", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "title-asc" }));
  const titles = result.items.map((w) => w.title);
  const sorted = [...titles].sort(compareJapaneseSortKeys);
  assert.deepEqual(titles, sorted);
});

test("sort: duration-desc は再生時間の降順", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "duration-desc" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ003", "RJ002", "RJ001"],
  );
});

test("sort: last-played は null を末尾に並べる", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "last-played" }));
  // RJ001(2025) > RJ003(2024) > RJ002(null)
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001", "RJ003", "RJ002"],
  );
});

test("sort: id-asc はID文字列比較", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "id-asc" }));
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001", "RJ002", "RJ003"],
  );
});

test("ページング: page/limit 両方指定時のみ slice し、total はフィルタ後・slice前の件数", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "id-asc", page: 2, limit: 1 }));
  assert.equal(result.total, 3);
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ002"],
  );
});

test("ページング: page か limit の片方のみ指定された場合は全件返す", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "id-asc", page: 2 }));
  assert.equal(result.total, 3);
  assert.equal(result.items.length, 3);
});

// ── stats: コレクション統計（軸・ドリル・検索・タグの絞り込みに一致させる） ──

test("stats: 絞り込み後・ページング前の集合から trackCount/durationSec を合算する", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ q: "ASMR" }));
  // RJ001(trackCount=3, dur=1800) + RJ002(trackCount=2, dur=3600)
  assert.deepEqual(result.stats, { trackCount: 5, durationSec: 5400 });
});

test("stats: page/limit で切り出しても全件（絞り込み後）の合計を返す", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "id-asc", page: 1, limit: 1 }));
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.stats, { trackCount: 6, durationSec: 10800 });
});

test("stats: totalDurationSec が未知（null）の作品は合計から除外する", () => {
  const worksWithUnknownDuration: WorkSummary[] = [
    ...WORKS,
    {
      ...WORKS[0]!,
      id: "RJ004",
      totalDurationSec: null,
      trackCount: 10,
    },
  ];
  const result = applyWorksQuery(worksWithUnknownDuration, baseQuery());
  assert.equal(result.stats.trackCount, 3 + 2 + 1 + 10);
  assert.equal(result.stats.durationSec, 1800 + 3600 + 5400);
});

// ── TASK-73: ページング前後の集合一致（重複・欠落なし） ──────────

const MANY_WORKS: WorkSummary[] = Array.from({ length: 10 }, (_, index) => ({
  id: `w-${String(index).padStart(2, "0")}`,
  title: `作品${index}`,
  cover: null,
  status: index % 4 === 0 ? "missing" : "ok",
  physicalPath: `/lib/w-${index}`,
  totalDurationSec: index * 300,
  addedAt: new Date(Date.now() - index * 86400000).toISOString(),
  errorMessage: null,
  urls: [],
  tags: index % 2 === 0 ? ["cv/水瀬なずな", "ASMR"] : ["cv/霧島レイ"],
  trackCount: 1,
  bookmarked: index % 3 === 0,
  lastPlayedAt: index % 2 === 0 ? RECENT : null,
  dlsite: emptyDlsiteState(),
}));

/** page を順に取って連結する（取得件数が total に達したら終了） */
function collectAllPages(query: Partial<WorksQuery>, limit = 3): WorkSummary[] {
  const collected: WorkSummary[] = [];
  for (let page = 1; ; page++) {
    const result = applyWorksQuery(MANY_WORKS, baseQuery({ ...query, page, limit }));
    collected.push(...result.items);
    if (collected.length >= result.total) return collected;
  }
}

test("ページング: 全sortでページ連結が全件と一致する（重複・欠落なし）", () => {
  for (const sort of sortIdSchema.options) {
    const collected = collectAllPages({ sort, seed: sort === "random" ? 42 : undefined });
    assert.equal(collected.length, MANY_WORKS.length, `${sort}: 欠落があります`);
    assert.equal(
      new Set(collected.map((w) => w.id)).size,
      MANY_WORKS.length,
      `${sort}: 重複があります`,
    );
  }
});

test("ページング: 検索・タグAND/OR・year擬似タグ・viewでもページ連結がフィルタ結果と一致する", () => {
  const cases: Array<[string, Partial<WorksQuery>]> = [
    ["検索", { q: "ASMR" }],
    ["タグAND", { tags: ["cv/水瀬なずな", "ASMR"], tagOp: "AND" }],
    ["タグOR", { tags: ["cv/水瀬なずな", "cv/霧島レイ"], tagOp: "OR" }],
    ["year擬似タグ", { tags: [`@year/${new Date().getFullYear()}`] }],
    ["view:fav", { view: "fav" }],
    ["view:missing", { view: "missing" }],
    ["view:unplayed", { view: "unplayed" }],
    ["view:recent", { view: "recent" }],
  ];
  for (const [label, query] of cases) {
    const unpaginated = applyWorksQuery(MANY_WORKS, baseQuery(query));
    const collected = collectAllPages(query);
    assert.deepEqual(
      collected.map((w) => w.id),
      unpaginated.items.map((w) => w.id),
      `${label}: ページ連結がフィルタ結果と一致しません`,
    );
  }
});
