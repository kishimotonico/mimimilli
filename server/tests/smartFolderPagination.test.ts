// TASK-74: GET /api/smart-folders/:id/works のサーバー側ページングを検証。
// fixture アダプタの evalSmartFolder を多数件データへの純粋関数呼び出しに差し替え、
// デフォルト適用・ページ連結・random seed 引継ぎ・total・固有 sort 維持を担保する。
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDlsiteState,
  toWorkListItem,
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type WorksPage,
  type WorkSummary,
} from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { evalSmartFolder } from "../src/core/smartFolder.ts";
import { nts } from "./helpers/tag.ts";

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
    tags: nts(["ASMR"]),
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
  };
}

function buildFolder(sort: SmartFolder["sort"]): SmartFolder {
  return {
    id: "sf-pagination",
    name: "ページング検証",
    rules: [],
    sort,
    createdAt: RECENT,
  };
}

function buildAppWithManyWorks(count = 210) {
  const adapter = createFixtureAdapter();
  const manyWorks = Array.from({ length: count }, (_, index) => summary(index));
  const folder = buildFolder("added-desc");
  adapter.evalSmartFolder = async (id, query) => {
    if (id !== folder.id) return null;
    const page = evalSmartFolder(folder, manyWorks, query);
    return page.seed === undefined
      ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
      : {
          items: page.items.map(toWorkListItem),
          total: page.total,
          stats: page.stats,
          seed: page.seed,
        };
  };
  adapter.listSmartFolders = async () => [folder];
  return createApp(adapter);
}

async function getSmartFolderWorks(
  app: ReturnType<typeof createApp>,
  query = "",
): Promise<WorksPage> {
  const res = await app.request(`/api/smart-folders/sf-pagination/works${query}`);
  assert.equal(res.status, 200);
  return (await res.json()) as WorksPage;
}

test("limit 未指定でも全件返さない（デフォルト page=1 + デフォルト limit）", async () => {
  const app = buildAppWithManyWorks(210);
  const body = await getSmartFolderWorks(app);
  assert.equal(body.items.length, WORKS_DEFAULT_PAGE_SIZE);
  assert.equal(body.total, 210);
});

test("limit のみ指定時は page=1 として動作する", async () => {
  const app = buildAppWithManyWorks(210);
  const body = await getSmartFolderWorks(app, "?limit=5");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, 210);
});

test("全件がページの連結で重複・欠落なく取得できる", async () => {
  const app = buildAppWithManyWorks(210);
  const first = await getSmartFolderWorks(app, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=1`);
  const second = await getSmartFolderWorks(app, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=2`);
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, 210, "ページ間で重複があります");
  assert.equal(ids.length, 210, "ページ間で欠落があります");
  assert.equal(second.total, 210);
});

test("randomソートは発行されたseedを次ページへ送ると重複・欠落なく取得できる", async () => {
  const folder = buildFolder("random");
  const adapter = createFixtureAdapter();
  const manyWorks = Array.from({ length: 210 }, (_, index) => summary(index));
  adapter.evalSmartFolder = async (id, query) => {
    if (id !== folder.id) return null;
    const page = evalSmartFolder(folder, manyWorks, query);
    return page.seed === undefined
      ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
      : {
          items: page.items.map(toWorkListItem),
          total: page.total,
          stats: page.stats,
          seed: page.seed,
        };
  };
  adapter.listSmartFolders = async () => [folder];
  const app = createApp(adapter);

  const first = await getSmartFolderWorks(app, "?limit=200&page=1");
  assert.equal(typeof first.seed, "number");
  const second = await getSmartFolderWorks(app, `?seed=${first.seed}&limit=200&page=2`);
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, 210, "random ページ間で重複があります");
  assert.equal(ids.length, 210, "random ページ間で欠落があります");
});

test("total はページング前の評価結果件数を返す", async () => {
  const app = buildAppWithManyWorks(210);
  const body = await getSmartFolderWorks(app, "?limit=5&page=3");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, 210);
});

test("スマートフォルダー固有の sort が維持される", async () => {
  const folder = buildFolder("title-asc");
  const adapter = createFixtureAdapter();
  const manyWorks = Array.from({ length: 210 }, (_, index) => summary(index));
  adapter.evalSmartFolder = async (id, query) => {
    if (id !== folder.id) return null;
    const page = evalSmartFolder(folder, manyWorks, query);
    return page.seed === undefined
      ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
      : {
          items: page.items.map(toWorkListItem),
          total: page.total,
          stats: page.stats,
          seed: page.seed,
        };
  };
  adapter.listSmartFolders = async () => [folder];
  const appSorted = createApp(adapter);

  const body = await getSmartFolderWorks(appSorted);
  const titles = body.items.map((w) => w.title);
  const expected = [...titles].sort();
  assert.deepEqual(titles, expected);
  assert.equal(body.total, 210);
});

test("クエリパラメータ不正は400", async () => {
  const app = buildAppWithManyWorks(10);
  const res = await app.request("/api/smart-folders/sf-pagination/works?page=0");
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error.code, "invalid_request");
});
