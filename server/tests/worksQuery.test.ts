import { test } from "node:test";
import assert from "node:assert/strict";
import type { WorkSummary, WorksQuery } from "@mimimilli/shared";
import { applyWorksQuery } from "../src/core/worksQuery.ts";

const NOW = new Date();
const RECENT = new Date(NOW.getTime() - 5 * 86400000).toISOString(); // 5日前
const OLD = new Date(NOW.getTime() - 100 * 86400000).toISOString(); // 100日前

const WORKS: WorkSummary[] = [
  {
    id: "RJ001",
    title: "耳かきASMR",
    coverImage: null,
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
  },
  {
    id: "RJ002",
    title: "添い寝ボイス",
    coverImage: null,
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
  },
  {
    id: "RJ003",
    title: "催眠音声",
    coverImage: null,
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

test("axis+axisValue: AXIS_TAG_PREFIX を使った完全一致", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ axis: "cv", axisValue: "水瀬なずな" }));
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ001", "RJ003"]);
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

test("sort: title-asc は localeCompare(ja) で並び替える", () => {
  const result = applyWorksQuery(WORKS, baseQuery({ sort: "title-asc" }));
  const titles = result.items.map((w) => w.title);
  const sorted = [...titles].sort((a, b) => a.localeCompare(b, "ja"));
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
