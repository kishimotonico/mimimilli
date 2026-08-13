// TASK-73: GET /works のサーバー側デフォルトページングと、ページ間の重複・欠落なしを検証。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDlsiteState,
  toWorkListItem,
  WORKS_DEFAULT_PAGE_SIZE,
  type WorksPage,
  type WorkSummary,
} from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { applyWorksQuery } from "../src/core/worksQuery.ts";

const RECENT = new Date(Date.now() - 5 * 86400000).toISOString();

function summary(index: number): WorkSummary {
  const id = `work-${String(index).padStart(4, "0")}`;
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    status: "ok",
    physicalPath: `/library/${id}`,
    totalDurationSec: 600,
    addedAt: RECENT,
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
  };
}

// fixture アダプタの queryWorks を、210件データへの applyWorksQuery に差し替える
function buildAppWithManyWorks(count = 210) {
  const adapter = createFixtureAdapter();
  const manyWorks = Array.from({ length: count }, (_, index) => summary(index));
  adapter.queryWorks = async (query) => {
    const page = applyWorksQuery(manyWorks, query);
    return page.seed === undefined
      ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
      : {
          items: page.items.map(toWorkListItem),
          total: page.total,
          stats: page.stats,
          seed: page.seed,
        };
  };
  return createApp(adapter);
}

async function getWorks(app: ReturnType<typeof createApp>, query = ""): Promise<WorksPage> {
  const res = await app.request(`/api/works${query}`);
  assert.equal(res.status, 200);
  return (await res.json()) as WorksPage;
}

test("limit 未指定でも全件返さない（デフォルト page=1 + デフォルト limit）", async () => {
  const app = buildAppWithManyWorks(210);
  const body = await getWorks(app);
  assert.equal(body.items.length, WORKS_DEFAULT_PAGE_SIZE);
  assert.equal(body.total, 210);
});

test("一覧HTTPレスポンスは軽量DTOの許可キーだけを返す", async () => {
  const app = buildAppWithManyWorks(1);
  const body = await getWorks(app);
  assert.deepEqual(Object.keys(body.items[0]!).sort(), [
    "bookmarked",
    "circleName",
    "cover",
    "dlsite",
    "folderName",
    "id",
    "lastPlayedAt",
    "status",
    "title",
    "totalDurationSec",
    "trackCount",
  ]);
  assert.deepEqual(Object.keys(body.items[0]!.dlsite).sort(), ["rjCode", "status"]);
  assert.equal("physicalPath" in body.items[0]!, false);
  assert.equal("playlists" in body.items[0]!, false);
});

test("limit のみ指定時は page=1 として動作する", async () => {
  const app = buildAppWithManyWorks(210);
  const body = await getWorks(app, "?limit=5");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, 210);
  assert.equal(body.items[0]!.id, "work-0000");
});

test("全件がページの連結で重複・欠落なく取得できる", async () => {
  const app = buildAppWithManyWorks(210);
  const first = await getWorks(app, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=1`);
  const second = await getWorks(app, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=2`);
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, 210, "ページ間で重複があります");
  assert.equal(ids.length, 210, "ページ間で欠落があります");
  assert.equal(second.total, 210);
});

test("randomソートは発行されたseedを次ページへ送ると重複・欠落なく取得できる", async () => {
  const app = buildAppWithManyWorks(210);
  const first = await getWorks(app, "?sort=random&limit=200&page=1");
  assert.equal(typeof first.seed, "number");
  const second = await getWorks(app, `?sort=random&seed=${first.seed}&limit=200&page=2`);
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, 210, "random ページ間で重複があります");
  assert.equal(ids.length, 210, "random ページ間で欠落があります");
});

test("スキャン後の新規作品も先頭ページ外なら次ページで取得できる", async () => {
  // デフォルト limit ちょうどの件数から1件増えるケース（追加作品は added-desc の先頭に来ても
  // 末尾ページの件数が増えるだけで、既存のページ境界ではみ出た分は次ページで取得できる）
  const app = buildAppWithManyWorks(WORKS_DEFAULT_PAGE_SIZE + 1);
  const first = await getWorks(app);
  assert.equal(first.items.length, WORKS_DEFAULT_PAGE_SIZE);
  const second = await getWorks(app, "?page=2");
  assert.equal(second.items.length, 1);
  assert.equal(second.total, WORKS_DEFAULT_PAGE_SIZE + 1);
});
