import assert from "node:assert/strict";
import { test } from "node:test";
import {
  emptyDlsiteState,
  normalizeTags,
  sortIdSchema,
  toWorkListItem,
  coverFieldsFromCover,
  type SmartFolderRule,
  type Work,
  type WorksQuery,
  type WorkSummary,
} from "@mimimilli/shared";
import { WorkRepo } from "../../src/adapters/real/workRepo.ts";
import { querySmartFolderWorks } from "../../src/adapters/real/smartFolderWorks.ts";
import { upsertTestWork, resolvedDuration } from "../helpers/workTestUtils.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { buildAxisFacets } from "../../src/core/axisFacets.ts";
import { evalSmartFolder } from "../../src/core/smartFolder.ts";
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
    cover: null,
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
  const { coverKind, coverImage } = coverFieldsFromCover(item.cover);
  const playlistId = trackCount > 0 ? crypto.randomUUID() : null;
  return {
    ...rest,
    coverKind,
    coverImage,
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
                ...resolvedDuration(60),
              })),
            },
          ]
        : [],
    resume: null,
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
    for (const item of dataset) upsertTestWork(repo, fullWork(item));
    db.sqlite
      .query(`
        INSERT INTO user.work_states
          (work_id, added_at, bookmarked, last_played_at)
        VALUES (?, ?, 1, NULL)
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
    for (const item of dataset) upsertTestWork(repo, fullWork(item));
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

test("複数サークルタグのcircleNameはsharedとrealでUTF-8 BINARY順の先頭に揃う", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const item = {
    ...dataset[0]!,
    tags: ["サークル/和風", "circle/Zeta", "circle/Alpha", "ASMR"],
  };
  try {
    upsertTestWork(repo, fullWork(item));
    const page = repo.queryWorks(baseQuery({ page: 1, limit: 1 }));
    assert.equal(toWorkListItem(item).circleName, "Alpha");
    assert.equal(page.items[0]?.circleName, toWorkListItem(item).circleName);
  } finally {
    db.close();
  }
});

test("realのDLsite通知集計とページは状態別に一覧契約を返す", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    const missing = fullWork({ ...dataset[0]!, dlsite: emptyDlsiteState() });
    const failed = fullWork({
      ...dataset[1]!,
      dlsite: {
        rjCode: "RJ123456",
        status: "error",
        lastAttemptAt: null,
        error: "failed",
        errorKind: null,
        appliedTags: [],
      },
    });
    const unlinked = fullWork({
      ...dataset[2]!,
      dlsite: {
        rjCode: "RJ123457",
        status: "none",
        lastAttemptAt: null,
        error: null,
        errorKind: null,
        appliedTags: [],
      },
    });
    upsertTestWork(repo, missing);
    upsertTestWork(repo, failed);
    upsertTestWork(repo, unlinked);

    assert.deepEqual(repo.getDlsiteNotificationSummary(), {
      rjCodeMissingCount: 1,
      fetchFailedCount: 1,
      parseErrorCount: 0,
      parseErrorAlert: false,
      unlinkedCount: 1,
    });
    assert.deepEqual(repo.queryDlsiteNotifications("rj-missing", { page: 1, limit: 10 }), {
      items: [{ id: missing.id, title: missing.title, status: "none", rjCode: null }],
      total: 1,
    });
    assert.deepEqual(repo.queryDlsiteNotifications("fetch-failed", { page: 1, limit: 10 }), {
      items: [{ id: failed.id, title: failed.title, status: "error", rjCode: null }],
      total: 1,
    });
  } finally {
    db.close();
  }
});

test("core参照実装とreal SQLのファセット値・件数・順序が同値", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const item of dataset) upsertTestWork(repo, fullWork(item));
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

function assertSmartFolderEquivalent(
  repo: WorkRepo,
  rules: SmartFolderRule[],
  sort: WorksQuery["sort"],
  query: { page: number; limit: number; seed?: number },
): void {
  const fixture = evalSmartFolder({ rules, sort }, dataset, query);
  const real = querySmartFolderWorks(repo, { rules, sort }, query);
  assert.deepEqual(
    real.items.map((work) => work.id),
    fixture.items.map((work) => work.id),
    `smart folder ordered IDs: ${JSON.stringify({ rules, sort, query })}`,
  );
  assert.equal(
    real.total,
    fixture.total,
    `smart folder total: ${JSON.stringify({ rules, query })}`,
  );
  assert.equal(real.seed, fixture.seed, `smart folder seed: ${JSON.stringify({ rules, query })}`);
}

test("スマートフォルダーのSQL候補絞り込み(第1段)とcore純粋関数の最終評価(第2段)がfixtureと同値", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    for (const item of dataset) upsertTestWork(repo, fullWork(item));

    const tagRule = (values: string[], conjunction: SmartFolderRule["conjunction"] = "WHERE") =>
      ({ conjunction, field: "タグ", operator: "∋", values }) as SmartFolderRule;
    const lengthRule = (minSec: number, conjunction: SmartFolderRule["conjunction"] = "WHERE") =>
      ({ conjunction, field: "長さ", operator: "≥", values: [String(minSec)] }) as SmartFolderRule;

    const fixedCases: Array<{ rules: SmartFolderRule[]; sort: WorksQuery["sort"] }> = [
      { rules: [], sort: "added-desc" }, // ルールなし = queryWorks の SQL ソート/ページング経路
      { rules: [tagRule(["ASMR", "cv/水瀬なずな"])], sort: "title-asc" },
      { rules: [tagRule(["存在しないタグ"])], sort: "added-desc" },
      { rules: [lengthRule(1200)], sort: "duration-desc" },
      { rules: [lengthRule(1200), tagRule(["催眠"], "AND")], sort: "duration-asc" },
      { rules: [lengthRule(1800), tagRule(["添い寝"], "OR")], sort: "id-asc" },
      { rules: [lengthRule(1800), tagRule(["添い寝"], "AND NOT")], sort: "last-played" },
      {
        rules: [tagRule(["ASMR"]), lengthRule(1200, "AND"), tagRule(["催眠"], "OR")],
        sort: "added-asc",
      },
      // 先頭ルールの conjunction が "AND NOT" でも、評価関数は index===0 を WHERE として
      // 扱う（先頭に否定は効かない）。real経路の候補ID絞り込みはconjunctionを見ずに
      // 全ルールの一致IDを和集合するだけなので、このエッジでも取りこぼしが無いことを確認する。
      { rules: [tagRule(["ASMR"], "AND NOT")], sort: "added-desc" }, // 否定のみの単一ルール
      { rules: [lengthRule(1200, "AND NOT")], sort: "duration-asc" }, // 否定のみの単一ルール（長さ）
      {
        rules: [tagRule(["ASMR"], "AND NOT"), tagRule(["催眠"], "OR")],
        sort: "id-asc",
      },
    ];
    for (const { rules, sort } of fixedCases) {
      assertSmartFolderEquivalent(repo, rules, sort, { page: 1, limit: 7 });
      assertSmartFolderEquivalent(repo, rules, sort, { page: 2, limit: 5 });
    }
    // random は同じseedを両経路へ与えて比較する
    assertSmartFolderEquivalent(repo, [lengthRule(0)], "random", {
      page: 1,
      limit: 6,
      seed: 42,
    });

    let state = 0x1234abcd;
    const next = (): number => {
      state = Math.imul(state ^ (state >>> 15), state | 1);
      state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
      return (state ^ (state >>> 14)) >>> 0;
    };
    const tagPool = ["ASMR", "asmr", "催眠", "添い寝", "耳かき", "cv/水瀬なずな", "存在しない"];
    const conjunctions: SmartFolderRule["conjunction"][] = ["AND", "OR", "AND NOT"];
    // 先頭ルールも "WHERE" 固定にせず全conjunctionから選ぶ（index===0はconjunctionを無視して
    // WHERE相当に振る舞うため、"先頭AND NOT"のようなエッジも生成テストへ混ぜる）。
    const leadingConjunctions: SmartFolderRule["conjunction"][] = ["WHERE", "AND", "OR", "AND NOT"];
    for (let index = 0; index < 40; index++) {
      const ruleCount = (next() % 3) + 1;
      const rules: SmartFolderRule[] = [];
      for (let i = 0; i < ruleCount; i++) {
        const conjunction =
          i === 0
            ? leadingConjunctions[next() % leadingConjunctions.length]!
            : conjunctions[next() % conjunctions.length]!;
        rules.push(
          next() % 2 === 0
            ? tagRule([tagPool[next() % tagPool.length]!], conjunction)
            : lengthRule((next() % 4) * 600, conjunction),
        );
      }
      const sort = sortIdSchema.options[next() % sortIdSchema.options.length]!;
      assertSmartFolderEquivalent(repo, rules, sort, {
        page: (next() % 4) + 1,
        limit: (next() % 6) + 1,
        seed: sort === "random" ? next() & 0x7fffffff : undefined,
      });
    }
  } finally {
    db.close();
  }
});

test("スマートフォルダー候補IDが900件を超えてもlistSummariesのchunk境界をまたいで同値", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  try {
    // listSummaries(workIds) はSQLiteのパラメータ上限を避けるため900件ごとに分割してIN句を発行する
    // （TASK-85）。候補IDがちょうどその境界をまたぐ件数になるデータセットで、分割・再結合が
    // 欠落や重複なく行われることを直接検証する。
    const largeDataset = Array.from({ length: 950 }, (_, index) => summary(index));
    for (const item of largeDataset) upsertTestWork(repo, fullWork(item));

    const rule: SmartFolderRule = {
      conjunction: "WHERE",
      field: "長さ",
      operator: "≥",
      values: ["0"],
    };
    const query = { page: 1, limit: largeDataset.length };

    const candidateIds = repo.resolveSmartFolderCandidateIds([rule]);
    assert.notEqual(candidateIds, null);
    assert.ok(
      candidateIds!.size > 900,
      `候補IDがchunk境界(900件)を超えている前提が崩れている: ${candidateIds!.size}`,
    );

    const works = repo.listSummaries([...candidateIds!]);
    assert.equal(works.length, candidateIds!.size, "chunk分割後も欠落・重複がない");

    const fixture = evalSmartFolder({ rules: [rule], sort: "id-asc" }, largeDataset, query);
    const real = evalSmartFolder({ rules: [rule], sort: "id-asc" }, works, query);
    assert.deepEqual(
      real.items.map((work) => work.id),
      fixture.items.map((work) => work.id),
    );
    assert.equal(real.total, fixture.total);
  } finally {
    db.close();
  }
});

test("tag軸はprefixタグを数えず、自由タグが無ければ空になる", () => {
  const db = openDb({ kind: "memory" });
  const repo = new WorkRepo(db);
  const annotatedOnly = dataset.map((item) => ({
    ...item,
    tags: item.tags.filter((tag) => tag.includes("/")),
  }));
  try {
    for (const item of annotatedOnly) upsertTestWork(repo, fullWork(item));

    assert.deepEqual(repo.getAxisFacets("tag"), buildAxisFacets("tag", annotatedOnly));
    assert.deepEqual(repo.getAxisFacets("tag"), []);
    assert.notDeepEqual(repo.getAxisFacets("cv"), []);
  } finally {
    db.close();
  }
});
