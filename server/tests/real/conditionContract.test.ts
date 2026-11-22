// 条件の木の評価（ADR-0040）: 同じ作品データの fixture adapter と real adapter に同じ木を渡し、
// 順序付きの作品 ID 列・total・stats・グループの値と件数・件数を比べる。固定時刻で回す。
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import {
  emptyDlsiteState,
  sortIdSchema,
  type Condition,
  type GroupValueItem,
  type GroupBy,
  type Work,
  type WorkSummary,
} from "@mimimilli/shared";
import { deriveCoverVersion } from "../../src/adapter/media.ts";
import type { DataAdapter } from "../../src/adapter/index.ts";
import type { EvalContext } from "../../src/adapter/condition.ts";
import { createFixtureAdapter } from "../../src/adapters/fixture/index.ts";
import { openDb } from "../../src/adapters/real/db.ts";
import { configureRoot } from "../helpers/rootFolder.ts";
import { createTestRealAdapter } from "../helpers/realAdapter.ts";
import { makeTestDirectory, writeSampleCover } from "../helpers/sampleLibrary.ts";
import { nts } from "../helpers/tag.ts";
import {
  coverFieldsFromCover,
  createWorkRepos,
  folderFixtureWork,
  makeWorkSummary,
  resolvedDuration,
  upsertTestWork,
} from "../helpers/workTestUtils.ts";

const NOW = Date.parse("2026-06-15T12:00:00.000Z");
const ctx: EvalContext = { now: NOW };
const DAY = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString();

const libraryRoot = mkdtempSync(join(tmpdir(), "condition-contract-"));

const titles = ["ＡＳＭＲ カタカナ", "asmr かたかな", "École", "Alpha", "耳かき", "ヴォイス", ""];
const durations = [null, 0, 600, 3599, 3600, 3601, 7200, null];
const addedAts = [
  iso(NOW - 30 * DAY),
  iso(NOW - 30 * DAY - 1),
  iso(NOW - 30 * DAY + 1),
  iso(NOW - DAY),
  "2025-12-31T23:59:59.999Z",
  "2026-01-01T00:00:00.000Z",
  iso(NOW - 400 * DAY),
  iso(NOW),
];
const playedAts = [
  null,
  iso(NOW - 7 * DAY),
  iso(NOW - 7 * DAY - 1),
  iso(NOW - 7 * DAY + 1),
  iso(NOW),
  null,
  iso(NOW - 200 * DAY),
];
const tagSets = [
  ["cv/水瀬なずな", "asmr", "気分/睡眠用"],
  ["cv/霧島レイ", "気分/作業用"],
  ["cv/水瀬なずな", "催眠", "シリーズ/夜"],
  ["サークル/夜想曲", "添い寝"],
  [],
  ["耳かき", "催眠"],
];

function coverFor(index: number, id: string): WorkSummary["cover"] {
  if (index % 5 !== 0) return null;
  const dir = join(libraryRoot, id);
  mkdirSync(dir, { recursive: true });
  const coverPath = join(dir, "cover.jpg");
  if (!existsSync(coverPath)) writeSampleCover(coverPath);
  const stat = statSync(coverPath);
  return {
    image: "cover.jpg",
    dimensions: { width: 6, height: 4 },
    version: deriveCoverVersion(id, undefined, { size: stat.size, mtimeMs: stat.mtimeMs }),
  };
}

function summary(index: number): WorkSummary {
  const id = `work-${String(index).padStart(3, "0")}`;
  const status = index % 9 === 0 ? "missing" : index % 13 === 0 ? "error" : "ok";
  return makeWorkSummary({
    id,
    title: titles[index % titles.length]!,
    cover: coverFor(index, id),
    status,
    physicalPath: join(libraryRoot, id),
    totalDurationSec: durations[index % durations.length]!,
    addedAt: addedAts[(index * 5 + 1) % addedAts.length]!,
    errorMessage: status === "error" ? "probe error" : null,
    tags: nts(tagSets[index % tagSets.length]!),
    trackCount: (index % 3) + 1,
    bookmarked: index % 3 === 0,
    lastPlayedAt: playedAts[index % playedAts.length]!,
    dlsite:
      index % 4 === 0
        ? { ...emptyDlsiteState(), rjCode: `RJ${String(1000000 + index).padStart(8, "0")}` }
        : emptyDlsiteState(),
  });
}

function fullWork(item: WorkSummary): Work {
  const { trackCount, ...rest } = item;
  const { coverKind, coverImage } = coverFieldsFromCover(item.cover);
  const playlistId = crypto.randomUUID();
  return {
    ...rest,
    coverKind,
    coverImage,
    defaultPlaylistId: playlistId,
    createdAt: item.addedAt,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: Array.from({ length: trackCount }, (_, index) => ({
          id: crypto.randomUUID(),
          title: `track-${index}`,
          file: `track-${index}.wav`,
          ...resolvedDuration(60),
        })),
      },
    ],
    resume: null,
  };
}

const dataset = Array.from({ length: 56 }, (_, index) => summary(index));

const tag = (name: string): Condition => ({ type: "tag", tag: name });
const not = (child: Condition): Condition => ({ type: "not", child });
const and = (...children: Condition[]): Condition => ({ type: "and", children });
const or = (...children: Condition[]): Condition => ({ type: "or", children });

/** 意味表の境界（長さ不明・未再生・基準時刻ちょうど・不明な値）を踏む葉 */
const leaves: Condition[] = [
  tag("cv/水瀬なずな"),
  tag("asmr"),
  tag("存在しないタグ"),
  { type: "hasPrefix", prefix: "cv" },
  { type: "hasPrefix", prefix: "気分" },
  { type: "hasPrefix", prefix: "存在しない" },
  { type: "duration", op: "gte", sec: 600 },
  { type: "duration", op: "gte", sec: 3600 },
  { type: "duration", op: "lte", sec: 3600 },
  { type: "duration", op: "lte", sec: 0 },
  { type: "bookmarked" },
  { type: "played" },
  { type: "played", withinDays: 7 },
  { type: "played", withinDays: 1 },
  { type: "added", withinDays: 30 },
  { type: "added", withinDays: 1 },
  { type: "addedYear", year: "2026" },
  { type: "addedYear", year: "2025" },
  { type: "addedYear", year: "1999" },
  { type: "hasError" },
  { type: "text", q: "asmr" },
  { type: "text", q: "かたかな" },
  { type: "text", q: "RJ01000004" },
  { type: "text", q: "01000008" },
  { type: "text", q: "" },
];

let rngState = 0x6d2b79f5;
function next(): number {
  rngState = Math.imul(rngState ^ (rngState >>> 15), rngState | 1);
  rngState ^= rngState + Math.imul(rngState ^ (rngState >>> 7), rngState | 61);
  return (rngState ^ (rngState >>> 14)) >>> 0;
}
const pick = <T>(items: readonly T[]): T => items[next() % items.length]!;

function randomTree(depth: number): Condition {
  const roll = next() % 10;
  if (depth === 0 || roll < 4) return pick(leaves);
  if (roll < 6) return not(randomTree(depth - 1));
  const children = Array.from({ length: next() % 4 }, () => randomTree(depth - 1));
  return roll < 8 ? and(...children) : or(...children);
}

const trees: Condition[] = [
  and(),
  or(),
  not(and()),
  ...leaves.flatMap((leaf): Condition[] => [
    leaf,
    not(leaf),
    and(leaf),
    or(leaf, not(leaf)),
    not(not(leaf)),
  ]),
  ...Array.from({ length: 160 }, () => randomTree(3)),
];

const groupBys: GroupBy[] = [
  { kind: "prefix", prefix: "cv" },
  { kind: "prefix", prefix: "気分" },
  { kind: "prefix", prefix: "tag" },
  { kind: "tag" },
  { kind: "addedYear" },
];

interface Adapters {
  fixture: DataAdapter;
  real: DataAdapter;
}

/** 全テストが読み取りだけなので、DB の用意（約1秒）はファイルで1回だけ行う */
let shared: Promise<Adapters> | null = null;
let cleanupShared: (() => void) | null = null;
after(() => cleanupShared?.());
function setup(): Promise<Adapters> {
  shared ??= createAdapters();
  return shared;
}

async function createAdapters(): Promise<Adapters> {
  const directory = makeTestDirectory("condition-contract");
  cleanupShared = directory.cleanup;
  const catalogPath = join(directory.path, "catalog.db");
  const userPath = join(directory.path, "user.db");
  const root = join(directory.path, "lib");
  mkdirSync(root, { recursive: true });
  const real = directory.own(
    createTestRealAdapter({ database: { kind: "files", catalogPath, userPath } }),
  );
  await configureRoot(real, root);
  const db = openDb({ kind: "files", catalogPath, userPath });
  const { catalog, user } = createWorkRepos(db);
  for (const item of dataset) upsertTestWork(catalog, user, fullWork(item));
  db.sqlite
    .query(
      "INSERT INTO user.work_states (work_id, added_at, bookmarked, last_played_at) VALUES (?, ?, 1, NULL)",
    )
    .run("orphan-user-work", iso(NOW));
  db.close();
  const fixture = createFixtureAdapter({ works: dataset.map(folderFixtureWork) });
  return { fixture, real };
}

/** カバーの version は実ファイルの stat 由来で adapter ごとに決まるため、同一性は作品とファイルで見る */
function normalizeGroupValues(items: GroupValueItem[]) {
  return items.map((item) => ({
    ...item,
    covers: item.covers.map(({ workId, image }) => ({ workId, image })),
  }));
}

test("条件の木の一覧は fixture と real で作品 ID 列・total・stats が一致する", async () => {
  const { fixture, real } = await setup();
  for (const condition of trees) {
    const sort = pick(sortIdSchema.options);
    const query = {
      condition,
      sort,
      seed: sort === "random" ? next() & 0x7fffffff : undefined,
      page: (next() % 4) + 1,
      limit: (next() % 12) + 1,
      ...(next() % 5 === 0 ? { ids: dataset.slice(0, 20).map((work) => work.id) } : {}),
    };
    const expected = await fixture.queryWorks(query, ctx);
    const actual = await real.queryWorks(query, ctx);
    const label = JSON.stringify(query);
    assert.deepEqual(
      actual.items.map((work) => work.id),
      expected.items.map((work) => work.id),
      `ordered IDs: ${label}`,
    );
    assert.equal(actual.total, expected.total, `total: ${label}`);
    assert.deepEqual(actual.stats, expected.stats, `stats: ${label}`);
  }
});

test("条件の木のグループの値一覧は fixture と real で値・件数・時間・カバーが一致する", async () => {
  const { fixture, real } = await setup();
  for (const condition of trees) {
    for (const groupBy of groupBys) {
      assert.deepEqual(
        normalizeGroupValues(await real.groupWorks({ condition, groupBy }, ctx)),
        normalizeGroupValues(await fixture.groupWorks({ condition, groupBy }, ctx)),
        JSON.stringify({ condition, groupBy }),
      );
    }
  }
});

test("条件の木の件数は fixture と real で一致し、入力順に返る", async () => {
  const { fixture, real } = await setup();
  assert.deepEqual(
    await real.countByConditions(trees, ctx),
    await fixture.countByConditions(trees, ctx),
  );
  assert.deepEqual(await real.countByConditions([], ctx), []);
  assert.deepEqual(await fixture.countByConditions([], ctx), []);
});

const ids = (predicate: (work: WorkSummary) => boolean): string[] =>
  dataset.filter(predicate).map((work) => work.id);

/** 意味表を core・SQL と独立に書いた期待値。両実装が同じ誤りをしていないことを見る */
const semanticCases: Array<{ name: string; condition: Condition; expected: string[] }> = [
  {
    name: "not(duration lte 3600) は長さ不明を含む",
    condition: and(not({ type: "duration", op: "lte", sec: 3600 })),
    expected: ids((w) => w.totalDurationSec === null || w.totalDurationSec > 3600),
  },
  {
    name: "duration lte 3600 は長さ不明を含まず、ちょうど3600を含む",
    condition: and({ type: "duration", op: "lte", sec: 3600 }),
    expected: ids((w) => w.totalDurationSec !== null && w.totalDurationSec <= 3600),
  },
  {
    name: "not(played) は未再生",
    condition: and(not({ type: "played" })),
    expected: ids((w) => w.lastPlayedAt === null),
  },
  {
    name: "played withinDays は基準時刻ちょうどを含み、1ms 前を含まない",
    condition: and({ type: "played", withinDays: 7 }),
    expected: ids((w) => w.lastPlayedAt !== null && w.lastPlayedAt >= iso(NOW - 7 * DAY)),
  },
  {
    name: "not(played withinDays) は未再生と範囲外",
    condition: and(not({ type: "played", withinDays: 7 })),
    expected: ids((w) => w.lastPlayedAt === null || w.lastPlayedAt < iso(NOW - 7 * DAY)),
  },
  {
    name: "added withinDays は基準時刻ちょうどを含む",
    condition: and({ type: "added", withinDays: 30 }),
    expected: ids((w) => w.addedAt >= iso(NOW - 30 * DAY)),
  },
  {
    name: "not(hasPrefix) は prefix を持たない作品",
    condition: and(not({ type: "hasPrefix", prefix: "cv" })),
    expected: ids((w) => !w.tags.some((t) => t.startsWith("cv/"))),
  },
  {
    name: "hasError は missing と error の両方",
    condition: and({ type: "hasError" }),
    expected: ids((w) => w.status !== "ok"),
  },
];

test("意味表の境界が独立に書いた期待値と fixture・real の両方で一致する", async () => {
  const adapters = await setup();
  for (const { name, condition, expected } of semanticCases) {
    assert.ok(expected.length > 0 && expected.length < dataset.length, `${name}: 期待値が自明`);
    const query = { condition, sort: "id-asc" as const, page: 1, limit: 500 };
    for (const [kind, adapter] of [
      ["fixture", adapters.fixture],
      ["real", adapters.real],
    ] as const) {
      const page = await adapter.queryWorks(query, ctx);
      assert.deepEqual(
        page.items.map((work) => work.id),
        expected,
        `${name} (${kind})`,
      );
    }
  }
});

test("sort=random で seed が無いと fixture も real も拒否する", async () => {
  const adapters = await setup();
  const query = { condition: and(), sort: "random" as const, page: 1, limit: 5 };
  for (const adapter of [adapters.fixture, adapters.real]) {
    await assert.rejects(adapter.queryWorks(query, ctx), /seed/);
  }
});
