// GET /api/smart-folders/:id/works のサーバー側ページングを fixture / real の両方で検証。
// デフォルト適用・ページ連結・random seed 引継ぎ・total・固有 sort 維持を担保する。
import assert from "node:assert/strict";
import { WORKS_DEFAULT_PAGE_SIZE, type SmartFolder, type WorksPage } from "@mimimilli/shared";
import { defineContract, numberedWorks, type ContractHarness } from "./helpers/contractHarness.ts";

const TOTAL = WORKS_DEFAULT_PAGE_SIZE + 10;
const contract = defineContract({ works: numberedWorks(TOTAL, ["ASMR"]) }, { shared: true });

async function createFolder(harness: ContractHarness, sort: SmartFolder["sort"]): Promise<string> {
  const { status, body } = await harness.send<SmartFolder>("POST", "/api/smart-folders", {
    name: `ページング検証 ${sort}`,
    rules: [],
    sort,
  });
  assert.equal(status, 201);
  return body.id;
}

async function getSmartFolderWorks(
  harness: ContractHarness,
  folderId: string,
  query = "",
): Promise<WorksPage> {
  const { status, body } = await harness.json<WorksPage>(
    `/api/smart-folders/${folderId}/works${query}`,
  );
  assert.equal(status, 200);
  return body;
}

contract(
  "limit 未指定でも全件返さない（デフォルト page=1 + デフォルト limit）",
  async (harness) => {
    const folderId = await createFolder(harness, "added-desc");
    const body = await getSmartFolderWorks(harness, folderId);
    assert.equal(body.items.length, WORKS_DEFAULT_PAGE_SIZE);
    assert.equal(body.total, TOTAL);
  },
);

contract("limit のみ指定時は page=1 として動作する", async (harness) => {
  const folderId = await createFolder(harness, "added-desc");
  const body = await getSmartFolderWorks(harness, folderId, "?limit=5");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, TOTAL);
});

contract("全件がページの連結で重複・欠落なく取得できる", async (harness) => {
  const folderId = await createFolder(harness, "added-desc");
  const first = await getSmartFolderWorks(
    harness,
    folderId,
    `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=1`,
  );
  const second = await getSmartFolderWorks(
    harness,
    folderId,
    `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=2`,
  );
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, TOTAL, "ページ間で重複があります");
  assert.equal(ids.length, TOTAL, "ページ間で欠落があります");
  assert.equal(second.total, TOTAL);
});

contract(
  "randomソートは発行されたseedを次ページへ送ると重複・欠落なく取得できる",
  async (harness) => {
    const folderId = await createFolder(harness, "random");
    const first = await getSmartFolderWorks(harness, folderId, "?limit=200&page=1");
    assert.equal(typeof first.seed, "number");
    const second = await getSmartFolderWorks(
      harness,
      folderId,
      `?seed=${first.seed}&limit=200&page=2`,
    );
    const ids = [...first.items, ...second.items].map((work) => work.id);
    assert.equal(new Set(ids).size, TOTAL, "random ページ間で重複があります");
    assert.equal(ids.length, TOTAL, "random ページ間で欠落があります");
  },
);

contract("total はページング前の評価結果件数を返す", async (harness) => {
  const folderId = await createFolder(harness, "added-desc");
  const body = await getSmartFolderWorks(harness, folderId, "?limit=5&page=3");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, TOTAL);
});

contract("スマートフォルダー固有の sort が維持される", async (harness) => {
  const folderId = await createFolder(harness, "title-asc");
  const body = await getSmartFolderWorks(harness, folderId);
  const titles = body.items.map((work) => work.title);
  assert.deepEqual(titles, [...titles].sort());
  assert.equal(body.total, TOTAL);
});

contract("作品検索qがHTTPクエリから評価まで渡る", async (harness) => {
  const folderId = await createFolder(harness, "added-desc");
  const body = await getSmartFolderWorks(harness, folderId, "?q=work-0005&limit=10");
  assert.deepEqual(
    body.items.map((work) => work.id),
    [harness.workId("work-0005")],
  );
  assert.equal(body.total, 1);
});

contract("クエリパラメータ不正は400", async (harness) => {
  const folderId = await createFolder(harness, "added-desc");
  const { status, body } = await harness.json(`/api/smart-folders/${folderId}/works?page=0`);
  assert.equal(status, 400);
  assert.equal(body.error.code, "invalid_request");
});
