// GET /works のサーバー側デフォルトページングと、ページ間の重複・欠落なしを fixture / real の両方で検証。
import assert from "node:assert/strict";
import { WORKS_DEFAULT_PAGE_SIZE, type WorksPage } from "@mimimilli/shared";
import { defineContract, numberedWorks, type ContractHarness } from "./helpers/contractHarness.ts";

const TOTAL = WORKS_DEFAULT_PAGE_SIZE + 10;
const contract = defineContract({ works: numberedWorks(TOTAL) }, { shared: true });

async function getWorks(harness: ContractHarness, query = ""): Promise<WorksPage> {
  const { status, body } = await harness.json<WorksPage>(`/api/works${query}`);
  assert.equal(status, 200);
  return body;
}

contract(
  "limit 未指定でも全件返さない（デフォルト page=1 + デフォルト limit）",
  async (harness) => {
    const body = await getWorks(harness);
    assert.equal(body.items.length, WORKS_DEFAULT_PAGE_SIZE);
    assert.equal(body.total, TOTAL);
  },
);

contract("一覧HTTPレスポンスは軽量DTOの許可キーだけを返す", async (harness) => {
  const body = await getWorks(harness, "?limit=1");
  const item = body.items[0]!;
  assert.deepEqual(Object.keys(item).sort(), [
    "bookmarked",
    "circleName",
    "cover",
    "dlsite",
    "id",
    "lastPlayedAt",
    "relativePath",
    "status",
    "title",
    "totalDurationSec",
    "trackCount",
  ]);
  assert.deepEqual(Object.keys(item.dlsite).sort(), ["rjCode", "status"]);
  assert.equal("physicalPath" in item, false);
  assert.equal("playlists" in item, false);
});

contract("limit のみ指定時は page=1 として動作する", async (harness) => {
  const body = await getWorks(harness, "?limit=5&sort=id-asc");
  assert.equal(body.items.length, 5);
  assert.equal(body.total, TOTAL);
  assert.equal(body.items[0]!.id, harness.workId("work-0000"));
});

contract("全件がページの連結で重複・欠落なく取得できる", async (harness) => {
  const first = await getWorks(harness, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=1`);
  const second = await getWorks(harness, `?limit=${WORKS_DEFAULT_PAGE_SIZE}&page=2`);
  const ids = [...first.items, ...second.items].map((work) => work.id);
  assert.equal(new Set(ids).size, TOTAL, "ページ間で重複があります");
  assert.equal(ids.length, TOTAL, "ページ間で欠落があります");
  assert.equal(second.total, TOTAL);
});

contract(
  "randomソートは発行されたseedを次ページへ送ると重複・欠落なく取得できる",
  async (harness) => {
    const first = await getWorks(harness, "?sort=random&limit=200&page=1");
    assert.equal(typeof first.seed, "number");
    const second = await getWorks(harness, `?sort=random&seed=${first.seed}&limit=200&page=2`);
    const ids = [...first.items, ...second.items].map((work) => work.id);
    assert.equal(new Set(ids).size, TOTAL, "random ページ間で重複があります");
    assert.equal(ids.length, TOTAL, "random ページ間で欠落があります");
  },
);

contract("デフォルト limit を超えた分は次ページで取得できる", async (harness) => {
  const second = await getWorks(harness, "?page=2");
  assert.equal(second.items.length, TOTAL - WORKS_DEFAULT_PAGE_SIZE);
  assert.equal(second.total, TOTAL);
});

for (const total of [WORKS_DEFAULT_PAGE_SIZE, WORKS_DEFAULT_PAGE_SIZE + 1]) {
  const boundary = defineContract({ works: numberedWorks(total) }, { shared: true });

  boundary(
    `デフォルト limit に対して ${total} 件のとき、1ページ目は上限まで・超過分だけが2ページ目`,
    async (harness) => {
      const first = await getWorks(harness);
      assert.equal(first.items.length, WORKS_DEFAULT_PAGE_SIZE);
      assert.equal(first.total, total);
      const second = await getWorks(harness, "?page=2");
      assert.equal(second.items.length, total - WORKS_DEFAULT_PAGE_SIZE);
      assert.equal(second.total, total);
    },
  );
}
