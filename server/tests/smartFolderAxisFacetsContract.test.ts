// スマートフォルダー表示中の軸ファセット（GET /axes/:axis?smartFolder=<id>）の契約テスト。
// fixture/real 両アダプタの ClassificationAdapter.getAxisFacets を実際に通し、
// 1) フォルダー条件で候補件数が絞り込まれること、2) チップ選択タグとのANDが
// スマートフォルダー結果一覧（evalSmartFolder）と同じ意味論であること、
// 3) fixture と real が同値であることを縛る。
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SmartFolder, SmartFolderRule, Work } from "@mimimilli/shared";
import { createClassificationMethods as createFixtureClassificationMethods } from "../src/adapters/fixture/classification.ts";
import type { FixtureWorkRecord } from "../src/adapters/fixture/data.ts";
import type { FixtureState } from "../src/adapters/fixture/state.ts";
import { createClassificationMethods as createRealClassificationMethods } from "../src/adapters/real/classificationMethods.ts";
import { openDb } from "../src/adapters/real/db.ts";
import { makeTestScope } from "./helpers/sampleLibrary.ts";
import { createWorkRepos, makeWork, upsertTestWork } from "./helpers/workTestUtils.ts";
import { nts, tf } from "./helpers/tag.ts";

const lengthRule: SmartFolderRule = {
  conjunction: "WHERE",
  field: "長さ",
  operator: "≥",
  values: ["1200"], // 20分以上
};
const rules: SmartFolderRule[] = [lengthRule];

const worksSpec: Array<{ id: string; tags: string[]; totalDurationSec: number }> = [
  { id: "w-a", tags: ["ASMR", "cv/水瀬なずな"], totalDurationSec: 1500 },
  { id: "w-b", tags: ["ASMR", "催眠"], totalDurationSec: 2000 },
  // 長さ条件を満たさない（rulesに一致しない）。cvタグを持つが、smartFolderスコープの
  // ファセットからは除外されるべき対照データ
  { id: "w-c", tags: ["添い寝", "cv/藤田茜"], totalDurationSec: 900 },
  { id: "w-d", tags: ["ASMR", "cv/水瀬なずな", "催眠"], totalDurationSec: 2500 },
];

function buildFixtureAdapter() {
  const works: FixtureWorkRecord[] = worksSpec.map((spec) => ({
    id: spec.id,
    title: `作品 ${spec.id}`,
    cover: null,
    status: "ok",
    physicalPath: `/library/${spec.id}`,
    metaPath: `/library/${spec.id}/mimimilli.json`,
    totalDurationSec: spec.totalDurationSec,
    addedAt: "2026-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: nts(spec.tags),
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
  }));
  const smartFolder: SmartFolder = {
    id: "sf-1",
    name: "テストフォルダー",
    rules,
    sort: "added-desc",
    createdAt: "2026-01-01T00:00:00.000Z",
  };
  const state = {
    works,
    dlsiteLinkages: new Map(),
    dlsiteFetchFailures: new Map(),
    tagPrefixes: [],
    smartFolders: [smartFolder],
    nextSmartFolderId: 2,
    rootFolder: "/library",
  } as unknown as FixtureState;
  return { adapter: createFixtureClassificationMethods(state), smartFolderId: smartFolder.id };
}

function buildRealAdapter() {
  const scope = makeTestScope();
  const db = scope.own(openDb({ kind: "memory" }));
  const { query, catalog, user } = createWorkRepos(db);
  for (const spec of worksSpec) {
    const work: Work = makeWork({
      id: spec.id,
      title: `作品 ${spec.id}`,
      tags: nts(spec.tags),
      totalDurationSec: spec.totalDurationSec,
      addedAt: "2026-01-01T00:00:00.000Z",
    });
    upsertTestWork(catalog, user, work);
  }
  const folder = user.createSmartFolder({ name: "テストフォルダー", rules, sort: "added-desc" });
  const adapter = createRealClassificationMethods({ query, user, requireRoot: () => "/library" });
  return { adapter, smartFolderId: folder.id, cleanup: scope.cleanup };
}

test("smartFolderスコープの軸ファセットはフォルダー条件適用後の集合だけを集計する（fixture）", async () => {
  const { adapter, smartFolderId } = buildFixtureAdapter();

  const scoped = await adapter.getAxisFacets("cv", { smartFolder: smartFolderId });
  // rule(長さ≥20分)に一致するのは w-a・w-b・w-d のみ。w-c は cv/藤田茜 を持つが除外される。
  assert.deepEqual(
    scoped!.map((item) => [item.value, item.count]),
    [["水瀬なずな", 2]],
  );

  const unscoped = await adapter.getAxisFacets("cv");
  assert.deepEqual(
    unscoped!.map((item) => item.value).sort(),
    ["水瀬なずな", "藤田茜"],
    "smartFolder未指定時は従来通り全作品を集計する",
  );
});

test("smartFolderスコープの軸ファセットはチップ選択タグとAND（スマートフォルダー結果一覧と同じ意味論）（fixture）", async () => {
  const { adapter, smartFolderId } = buildFixtureAdapter();

  // rule一致(w-a,w-b,w-d)のうち「催眠」タグを持つのは w-b・w-d。cv軸を持つのは w-d のみ。
  const scopedWithTag = await adapter.getAxisFacets("cv", {
    smartFolder: smartFolderId,
    tags: tf("催眠"),
    tagOp: "AND",
  });
  assert.deepEqual(
    scopedWithTag!.map((item) => [item.value, item.count]),
    [["水瀬なずな", 1]],
  );

  // 同じ tags/tagOp を渡した作品一覧（evalSmartFolder）でも該当は w-b・w-d の2件
  // （cv軸に絞ると w-d のみだが、作品一覧はcvを持たない w-b も含む。意味論が一致することの確認）
  const page = await adapter.evalSmartFolder(smartFolderId, {
    page: 1,
    limit: 10,
    tags: tf("催眠"),
    tagOp: "AND",
  });
  assert.deepEqual(page!.items.map((w) => w.id).sort(), ["w-b", "w-d"]);
});

test("smartFolderが解決できない場合はnullを返す（ルートが404に変換する。/smart-folders/:id/worksと同じ応答に揃える）", async () => {
  const fixtureResult = await buildFixtureAdapter().adapter.getAxisFacets("cv", {
    smartFolder: "sf-does-not-exist",
  });
  assert.equal(fixtureResult, null);

  const real = buildRealAdapter();
  try {
    const realResult = await real.adapter.getAxisFacets("cv", {
      smartFolder: "sf-does-not-exist",
    });
    assert.equal(realResult, null);
  } finally {
    real.cleanup();
  }
});

test("smartFolderスコープの軸ファセットはfixtureとrealで同値", async (t) => {
  const fixture = buildFixtureAdapter();
  const real = buildRealAdapter();
  t.after(real.cleanup);

  for (const axis of ["cv", "tag"]) {
    const fixtureScoped = await fixture.adapter.getAxisFacets(axis, {
      smartFolder: fixture.smartFolderId,
    });
    const realScoped = await real.adapter.getAxisFacets(axis, { smartFolder: real.smartFolderId });
    assert.deepEqual(
      realScoped!.map(({ value, count, durationSec }) => ({ value, count, durationSec })),
      fixtureScoped!.map(({ value, count, durationSec }) => ({ value, count, durationSec })),
      `axis=${axis}`,
    );
  }

  for (const filter of [
    { tags: tf("催眠"), tagOp: "AND" as const },
    { tags: tf("ASMR"), tagOp: "AND" as const },
  ]) {
    const fixtureScoped = await fixture.adapter.getAxisFacets("cv", {
      smartFolder: fixture.smartFolderId,
      ...filter,
    });
    const realScoped = await real.adapter.getAxisFacets("cv", {
      smartFolder: real.smartFolderId,
      ...filter,
    });
    assert.deepEqual(
      realScoped!.map(({ value, count, durationSec }) => ({ value, count, durationSec })),
      fixtureScoped!.map(({ value, count, durationSec }) => ({ value, count, durationSec })),
      `filter=${JSON.stringify(filter)}`,
    );
  }
});
