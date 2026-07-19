import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDlsiteState,
  normalizeTags,
  sortIdSchema,
  type Work,
  type WorksQuery,
  type WorkSummary,
} from "@mimimilli/shared";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { buildAxisFacets } from "../../src/core/axisFacets.ts";
import { applyWorksQuery } from "../../src/core/worksQuery.ts";

const recent = new Date(Date.now() - 5 * 86400000).toISOString();
const old = new Date(Date.now() - 100 * 86400000).toISOString();
const titles = [
  "ＡＳＭＲ カタカナ",
  "asmr かたかな",
  "École",
  "E\u0301cole",
  "Alpha",
  "alpha",
  "耳かき",
  "添い寝",
  "催眠音声",
  "ヴォイス",
  "ぼいす",
  "",
];

function summary(index: number): WorkSummary {
  const id = `work-${String(index).padStart(3, "0")}`;
  const tagSets = [
    ["cv/水瀬なずな", "ASMR", "気分/睡眠用"],
    ["cv/霧島レイ", "asmr", "気分/作業用"],
    ["cv/水瀬なずな", "催眠", "シリーズ/夜"],
    ["CV/水瀬なずな", "耳かき", "シリーズ/朝"],
    ["サークル/夜想曲", "添い寝"],
  ];
  return {
    id,
    title: titles[index % titles.length]!,
    coverImage: null,
    status: index % 7 === 0 ? "missing" : index % 11 === 0 ? "error" : "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: (index % 4) * 600,
    addedAt: index % 3 === 0 ? recent : old,
    errorMessage: index % 11 === 0 ? "probe error" : null,
    urls: [],
    tags: normalizeTags([...tagSets[index % tagSets.length]!, "e\u0301x/Ｂeta", "e\u0301x/Ａlpha"]),
    trackCount: (index % 3) + 1,
    bookmarked: index % 2 === 0,
    lastPlayedAt: index % 4 === 0 ? "2026-06-01T00:00:00.000Z" : index % 4 === 1 ? null : old,
    dlsite: emptyDlsiteState(),
  };
}

function fullWork(item: WorkSummary): Work {
  const { trackCount, ...rest } = item;
  const playlistId = trackCount > 0 ? crypto.randomUUID() : null;
  return {
    ...rest,
    defaultPlaylistId: playlistId,
    createdAt: item.addedAt,
    playlists:
      trackCount > 0
        ? [
            {
              id: playlistId!,
              name: "default",
              tracks: Array.from({ length: trackCount }, (_, index) => ({
                id: crypto.randomUUID(),
                title: `track-${index}`,
                file: `track-${index}.wav`,
              })),
            },
          ]
        : [],
    resumePosition: 0,
    resumeTrackIndex: 0,
  };
}

const dataset = Array.from({ length: 36 }, (_, index) => summary(index));

function baseQuery(overrides: Partial<WorksQuery> = {}): WorksQuery {
  return { q: "", tags: [], tagOp: "AND", sort: "added-desc", ...overrides };
}

function assertQueryEquivalent(repo: WorkRepo, query: WorksQuery): void {
  const fixture = applyWorksQuery(dataset, query);
  const real = repo.queryWorks(query);
  assert.deepEqual(
    real.items.map((work) => work.id),
    fixture.items.map((work) => work.id),
    `ordered IDs: ${JSON.stringify(query)}`,
  );
  assert.equal(real.total, fixture.total, `total: ${JSON.stringify(query)}`);
  assert.equal(real.seed, fixture.seed, `seed: ${JSON.stringify(query)}`);
}

test("core参照実装とreal SQLは固定例・生成クエリで同値", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const item of dataset) repo.upsertWork(fullWork(item));
    db.sqlite
      .query(`
        INSERT INTO user.work_states
          (work_id, added_at, bookmarked, last_played_at, resume_position, resume_track_index)
        VALUES (?, ?, 1, NULL, 10, 1)
      `)
      .run("orphan-user-work", recent);

    const fixedQueries: WorksQuery[] = [
      baseQuery({ q: "ＡＳＭＲ" }),
      baseQuery({ q: "カタカナ" }),
      baseQuery({ q: "éCOLE" }),
      baseQuery({ tags: ["CV/水瀬なずな", "ASMR"], tagOp: "AND" }),
      baseQuery({ tags: ["催眠", "添い寝"], tagOp: "OR" }),
      baseQuery({ axis: "cv", axisValue: "水瀬なずな" }),
      baseQuery({ axis: "year", axisValue: recent.slice(0, 4) }),
      baseQuery({ view: "fav" }),
      baseQuery({ view: "recent" }),
      baseQuery({ view: "added" }),
      baseQuery({ view: "unplayed" }),
      baseQuery({ view: "missing" }),
      baseQuery({ page: 2, limit: 7 }),
      baseQuery({ page: 99, limit: 7 }),
      baseQuery({ page: 2 }),
    ];
    for (const sort of sortIdSchema.options) {
      fixedQueries.push(baseQuery({ sort, seed: sort === "random" ? 123456 : undefined }));
      fixedQueries.push(
        baseQuery({ sort, seed: sort === "random" ? 98765 : undefined, page: 3, limit: 5 }),
      );
    }
    for (const query of fixedQueries) assertQueryEquivalent(repo, query);

    let state = 0x6d2b79f5;
    const next = (): number => {
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      return (state ^ (state >>> 14)) >>> 0;
    };
    const queryTerms = ["", "asmr", "カタカナ", "かたかな", "É", "催眠", "不存在"];
    const tagFilters = [[], ["ASMR"], ["cv/水瀬なずな"], ["催眠", "添い寝"]];
    const views = [undefined, "all", "recent", "added", "fav", "unplayed", "missing"] as const;
    for (let index = 0; index < 120; index++) {
      const sort = sortIdSchema.options[next() % sortIdSchema.options.length]!;
      const tags = tagFilters[next() % tagFilters.length]!;
      const useAxis = next() % 4 === 0;
      assertQueryEquivalent(
        repo,
        baseQuery({
          q: queryTerms[next() % queryTerms.length]!,
          tags,
          tagOp: next() % 2 === 0 ? "AND" : "OR",
          view: views[next() % views.length],
          axis: useAxis ? "cv" : undefined,
          axisValue: useAxis ? (next() % 2 === 0 ? "水瀬なずな" : "霧島レイ") : undefined,
          sort,
          seed: sort === "random" ? next() & 0x7fffffff : undefined,
          page: (next() % 8) + 1,
          limit: (next() % 9) + 1,
        }),
      );
    }
  } finally {
    db.close();
  }
});

test("realのrandomはseedを発行し、同じseedの次要求でページ順を再現する", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const item of dataset) repo.upsertWork(fullWork(item));
    const first = repo.queryWorks(baseQuery({ sort: "random", page: 2, limit: 8 }));
    assert.notEqual(first.seed, undefined);
    const repeated = repo.queryWorks(
      baseQuery({ sort: "random", seed: first.seed, page: 2, limit: 8 }),
    );
    assert.deepEqual(
      repeated.items.map((work) => work.id),
      first.items.map((work) => work.id),
    );
  } finally {
    db.close();
  }
});

test("core参照実装とreal SQLのファセット値・件数・順序が同値", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const item of dataset) repo.upsertWork(fullWork(item));
    for (const axis of ["tag", "year", "cv", "気分", "シリーズ", "e\u0301x", "unknown"]) {
      assert.deepEqual(repo.getAxisFacets(axis), buildAxisFacets(axis, dataset), axis);
    }
    assert.deepEqual(repo.getAxisFacets("e\u0301x"), [
      { value: "Ａlpha", count: dataset.length },
      { value: "Ｂeta", count: dataset.length },
    ]);
  } finally {
    db.close();
  }
});
