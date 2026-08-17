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
import { WorkQueryRepository } from "../../src/adapters/real/workQueryRepository.ts";
import { querySmartFolderWorks } from "../../src/adapters/real/smartFolderWorks.ts";
import { nts, tf, EMPTY_TAG_FILTERS } from "../helpers/tag.ts";
import { upsertTestWork, resolvedDuration, createWorkRepos } from "../helpers/workTestUtils.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { makeTestScope } from "../helpers/sampleLibrary.ts";
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

// RJ/VJコード検索の同値検証用。3件おきにRJコード、7件おきにVJコードを割り当てる
// （残りはemptyDlsiteStateのまま = rjCodeなし。core⇔real双方で「rjCodeなし作品は
// コード検索にヒットしない」経路も混在させる）。
function dlsiteStateFor(index: number): WorkSummary["dlsite"] {
  if (index % 3 === 0) {
    return { ...emptyDlsiteState(), rjCode: `RJ${String(1000000 + index).padStart(8, "0")}` };
  }
  if (index % 7 === 0) {
    return { ...emptyDlsiteState(), rjCode: `VJ${String(20000 + index).padStart(6, "0")}` };
  }
  return emptyDlsiteState();
}

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
    dlsite: dlsiteStateFor(index),
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

function catalogSeedWork(item: WorkSummary): Work {
  const { trackCount: _trackCount, ...rest } = item;
  const { coverKind, coverImage } = coverFieldsFromCover(item.cover);
  return {
    ...rest,
    coverKind,
    coverImage,
    defaultPlaylistId: null,
    createdAt: item.addedAt,
    playlists: [],
    resume: null,
  };
}

const dataset = Array.from({ length: 36 }, (_, index) => summary(index));

function baseQuery(overrides: Partial<WorksQuery> = {}): WorksQuery {
  return { q: "", tags: EMPTY_TAG_FILTERS, tagOp: "AND", sort: "added-desc", ...overrides };
}

function assertQueryEquivalent(queryRepo: WorkQueryRepository, query: WorksQuery): void {
  const fixture = applyWorksQuery(dataset, query);
  const real = queryRepo.queryWorks(query, "/library");
  assert.deepEqual(
    real.items.map((work) => work.id),
    fixture.items.map((work) => work.id),
    `ordered IDs: ${JSON.stringify(query)}`,
  );
  assert.equal(real.total, fixture.total, `total: ${JSON.stringify(query)}`);
  assert.deepEqual(real.stats, fixture.stats, `stats: ${JSON.stringify(query)}`);
  assert.equal(real.seed, fixture.seed, `seed: ${JSON.stringify(query)}`);
}

test("core参照実装とreal SQLは固定例・生成クエリで同値", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));
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
    baseQuery({ q: "RJ01000003" }),
    baseQuery({ q: "rj01000003" }),
    baseQuery({ q: "01000003" }),
    baseQuery({ q: "VJ020007" }),
    baseQuery({ q: "vj020007" }),
    baseQuery({ q: "020007" }),
    baseQuery({ q: "RJ" }),
    baseQuery({ q: "VJ" }),
    baseQuery({ tags: tf("CV/水瀬なずな", "ASMR"), tagOp: "AND" }),
    baseQuery({ tags: tf("催眠", "添い寝"), tagOp: "OR" }),
    baseQuery({ tags: tf(`@year/${recent.slice(0, 4)}`) }),
    baseQuery({ tags: tf("ASMR", `@year/${recent.slice(0, 4)}`), tagOp: "AND" }),
    baseQuery({ view: "fav" }),
    baseQuery({ view: "recent" }),
    baseQuery({ view: "added" }),
    baseQuery({ view: "error" }),
    baseQuery({ page: 2, limit: 7 }),
    baseQuery({ page: 99, limit: 7 }),
    baseQuery({ page: 2 }),
    baseQuery({ ids: [] }),
    baseQuery({ ids: ["work-005", "work-010", "work-not-exist"] }),
    baseQuery({ ids: ["work-005"], tags: tf("ASMR") }),
    baseQuery({ ids: dataset.slice(0, 4).map((w) => w.id), page: 1, limit: 2 }),
    baseQuery({ ids: dataset.slice(0, 4).map((w) => w.id), sort: "title-asc" }),
  ];
  for (const sort of sortIdSchema.options) {
    fixedQueries.push(baseQuery({ sort, seed: sort === "random" ? 123456 : undefined }));
    fixedQueries.push(
      baseQuery({ sort, seed: sort === "random" ? 98765 : undefined, page: 3, limit: 5 }),
    );
  }
  for (const query of fixedQueries) assertQueryEquivalent(queryRepo, query);

  let state = 0x6d2b79f5;
  const next = (): number => {
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return (state ^ (state >>> 14)) >>> 0;
  };
  const queryTerms = [
    "",
    "asmr",
    "カタカナ",
    "かたかな",
    "É",
    "催眠",
    "不存在",
    "RJ01000003",
    "01000003",
    "vj020007",
    "020007",
    "RJ",
    "rj9999999",
  ];
  const tagFilters = [[], ["ASMR"], ["cv/水瀬なずな"], ["催眠", "添い寝"]];
  const views = [undefined, "all", "recent", "added", "fav", "error"] as const;
  // year擬似タグ（@year/...）は実タグと混在してtagsへ渡る（ADR-0012 §2）。生成テストでも
  // 単独・実タグとの組み合わせの両方を織り交ぜる
  const yearPool = [recent.slice(0, 4), old.slice(0, 4), "1999"];
  for (let index = 0; index < 120; index++) {
    const sort = sortIdSchema.options[next() % sortIdSchema.options.length]!;
    const tags = tagFilters[next() % tagFilters.length]!;
    const useYearTag = next() % 4 === 0;
    const yearTag = useYearTag ? `@year/${yearPool[next() % yearPool.length]!}` : null;
    const useIds = next() % 4 === 0;
    const ids = useIds
      ? Array.from({ length: (next() % 6) + 1 }, () => dataset[next() % dataset.length]!.id)
      : undefined;
    assertQueryEquivalent(
      queryRepo,
      baseQuery({
        q: queryTerms[next() % queryTerms.length]!,
        tags: tf(...(yearTag ? [...tags, yearTag] : tags)),
        tagOp: next() % 2 === 0 ? "AND" : "OR",
        view: views[next() % views.length],
        sort,
        seed: sort === "random" ? next() & 0x7fffffff : undefined,
        page: (next() % 8) + 1,
        limit: (next() % 9) + 1,
        ids,
      }),
    );
  }
});

test("realのrandomはseedを発行し、同じseedの次要求でページ順を再現する", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));
  const first = queryRepo.queryWorks(baseQuery({ sort: "random", page: 2, limit: 8 }), "/library");
  assert.notEqual(first.seed, undefined);
  const repeated = queryRepo.queryWorks(
    baseQuery({ sort: "random", seed: first.seed, page: 2, limit: 8 }),
    "/library",
  );
  assert.deepEqual(
    repeated.items.map((work) => work.id),
    first.items.map((work) => work.id),
  );
});

test("複数サークルタグのcircleNameはsharedとrealでUTF-8 BINARY順の先頭に揃う", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  const item = {
    ...dataset[0]!,
    tags: nts(["サークル/和風", "circle/Zeta", "circle/Alpha", "ASMR"]),
  };
  upsertTestWork(catalog, user, fullWork(item));
  const page = queryRepo.queryWorks(baseQuery({ page: 1, limit: 1 }), "/library");
  assert.equal(toWorkListItem(item, "/library").circleName, "Alpha");
  assert.equal(page.items[0]?.circleName, toWorkListItem(item, "/library").circleName);
});

test("realのDLsite通知集計とページは状態別に一覧契約を返す", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
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
  upsertTestWork(catalog, user, missing);
  upsertTestWork(catalog, user, failed);
  upsertTestWork(catalog, user, unlinked);

  assert.deepEqual(queryRepo.getDlsiteNotificationSummary(), {
    rjCodeMissingCount: 1,
    fetchFailedCount: 1,
    parseErrorCount: 0,
    parseErrorAlert: false,
    unlinkedCount: 1,
  });
  assert.deepEqual(queryRepo.queryDlsiteNotifications("rj-missing", { page: 1, limit: 10 }), {
    items: [{ id: missing.id, title: missing.title, status: "none", rjCode: null }],
    total: 1,
  });
  assert.deepEqual(queryRepo.queryDlsiteNotifications("fetch-failed", { page: 1, limit: 10 }), {
    items: [{ id: failed.id, title: failed.title, status: "error", rjCode: null }],
    total: 1,
  });
});

test("core参照実装とreal SQLのファセット値・件数・順序が同値", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));
  for (const axis of ["tag", "year", "cv", "気分", "シリーズ", "e\u0301x", "unknown"]) {
    assert.deepEqual(queryRepo.getAxisFacets(axis), buildAxisFacets(axis, dataset), axis);
  }
  const exDurationSec = dataset.reduce((sum, work) => sum + (work.totalDurationSec ?? 0), 0);
  assert.deepEqual(queryRepo.getAxisFacets("e\u0301x"), [
    { value: "Ａlpha", count: dataset.length, durationSec: exDurationSec, covers: [] },
    { value: "Ｂeta", count: dataset.length, durationSec: exDurationSec, covers: [] },
  ]);
});

test("軸ファセットの絞り込み（自軸除外カウント用フィルタ）もreal SQLとcoreが同値（TASK-187）", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));
  const filters: Array<{
    tags?: import("@mimimilli/shared").TagFilters;
    tagOp?: "AND" | "OR";
  }> = [
    { tags: tf("ASMR"), tagOp: "AND" },
    { tags: tf("ASMR", "催眠"), tagOp: "OR" },
    { tags: tf("asmr", "cv/水瀬なずな"), tagOp: "AND" },
    { tags: tf(`@year/${recent.slice(0, 4)}`) },
    { tags: tf("ASMR", `@year/${recent.slice(0, 4)}`), tagOp: "AND" },
    // 該当作品が無い絞り込みは0件で一覧が空になるはず（除外の同値確認）
    { tags: tf("存在しないタグ"), tagOp: "AND" },
  ];
  for (const axis of ["tag", "year", "cv", "サークル", "気分", "シリーズ"]) {
    for (const filter of filters) {
      assert.deepEqual(
        queryRepo.getAxisFacets(axis, filter),
        buildAxisFacets(axis, dataset, filter),
        `${axis}: ${JSON.stringify(filter)}`,
      );
    }
  }
});

function assertSmartFolderEquivalent(
  queryRepo: WorkQueryRepository,
  rules: SmartFolderRule[],
  sort: WorksQuery["sort"],
  query: {
    page: number;
    limit: number;
    seed?: number;
    tags?: import("@mimimilli/shared").TagFilters;
    tagOp?: "AND" | "OR";
  },
): void {
  const fixture = evalSmartFolder({ rules, sort }, dataset, query);
  const real = querySmartFolderWorks(queryRepo, { rules, sort }, query, "/library");
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
  assert.deepEqual(
    real.stats,
    fixture.stats,
    `smart folder stats: ${JSON.stringify({ rules, query })}`,
  );
  assert.equal(real.seed, fixture.seed, `smart folder seed: ${JSON.stringify({ rules, query })}`);
}

test("スマートフォルダーのSQL候補絞り込み(第1段)とcore純粋関数の最終評価(第2段)がfixtureと同値", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));

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
    assertSmartFolderEquivalent(queryRepo, rules, sort, { page: 1, limit: 7 });
    assertSmartFolderEquivalent(queryRepo, rules, sort, { page: 2, limit: 5 });
  }
  // random は同じseedを両経路へ与えて比較する
  assertSmartFolderEquivalent(queryRepo, [lengthRule(0)], "random", {
    page: 1,
    limit: 6,
    seed: 42,
  });

  // 保持中フィルタ（tags、@year/... 擬似タグも含む）はルールに対する追加のAND条件（TASK-185）。
  // ルールなし（第1段のSQL高速経路）・ルールあり（第2段のcore純粋関数経路）の両方で
  // real⇔fixtureが同値になることを確認する。
  assertSmartFolderEquivalent(queryRepo, [], "added-desc", {
    page: 1,
    limit: 7,
    tags: tf("ASMR"),
    tagOp: "AND",
  });
  assertSmartFolderEquivalent(queryRepo, [], "added-desc", {
    page: 1,
    limit: 7,
    tags: tf(`@year/${recent.slice(0, 4)}`),
  });
  assertSmartFolderEquivalent(queryRepo, [lengthRule(0)], "title-asc", {
    page: 1,
    limit: 7,
    tags: tf("cv/水瀬なずな"),
    tagOp: "AND",
  });
  assertSmartFolderEquivalent(queryRepo, [tagRule(["ASMR", "催眠"])], "duration-desc", {
    page: 1,
    limit: 7,
    tags: tf(`@year/${recent.slice(0, 4)}`),
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
    assertSmartFolderEquivalent(queryRepo, rules, sort, {
      page: (next() % 4) + 1,
      limit: (next() % 6) + 1,
      seed: sort === "random" ? next() & 0x7fffffff : undefined,
    });
  }
});

test(
  "スマートフォルダー候補IDが900件を超えてもlistSummariesのchunk境界をまたいで同値",
  { timeout: 15_000 },
  (t) => {
    const scope = makeTestScope();
    t.after(scope.cleanup);
    const db = scope.own(openDb({ kind: "memory" }));
    const { query: queryRepo, catalog, user } = createWorkRepos(db);
    // listSummaries(workIds) はSQLiteのパラメータ上限を避けるため900件ごとに分割してIN句を発行する
    // （TASK-85）。候補IDがちょうどその境界をまたぐ件数になるデータセットで、分割・再結合が
    // 欠落や重複なく行われることを直接検証する。
    const largeDataset = Array.from({ length: 950 }, (_, index) => summary(index));
    db.transaction(() => {
      for (const item of largeDataset) upsertTestWork(catalog, user, catalogSeedWork(item));
    });

    const rule: SmartFolderRule = {
      conjunction: "WHERE",
      field: "長さ",
      operator: "≥",
      values: ["0"],
    };
    const query = { page: 1, limit: largeDataset.length };

    const candidateIds = queryRepo.resolveSmartFolderCandidateIds([rule]);
    assert.notEqual(candidateIds, null);
    assert.ok(
      candidateIds!.size > 900,
      `候補IDがchunk境界(900件)を超えている前提が崩れている: ${candidateIds!.size}`,
    );

    const works = queryRepo.listSummaries([...candidateIds!]).summaries;
    assert.equal(works.length, candidateIds!.size, "chunk分割後も欠落・重複がない");

    const fixture = evalSmartFolder({ rules: [rule], sort: "id-asc" }, largeDataset, query);
    const real = evalSmartFolder({ rules: [rule], sort: "id-asc" }, works, query);
    assert.deepEqual(
      real.items.map((work) => work.id),
      fixture.items.map((work) => work.id),
    );
    assert.equal(real.total, fixture.total);
  },
);

test("tag軸はprefixタグも自由タグも数える（ADR-0005 追記）", (t) => {
  const scope = makeTestScope();
  t.after(scope.cleanup);
  const db = scope.own(openDb({ kind: "memory" }));
  const { query: queryRepo, catalog, user } = createWorkRepos(db);
  const annotatedOnly = dataset.map((item) => ({
    ...item,
    tags: item.tags.filter((tag) => tag.includes("/")),
  }));
  for (const item of annotatedOnly) upsertTestWork(catalog, user, fullWork(item));

  assert.deepEqual(queryRepo.getAxisFacets("tag"), buildAxisFacets("tag", annotatedOnly));
  assert.notDeepEqual(queryRepo.getAxisFacets("tag"), []);
  assert.notDeepEqual(queryRepo.getAxisFacets("cv"), []);
});
