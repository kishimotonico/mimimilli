// /api/smart-folders 以下の契約（ADR-0040）を fixture / real の両方で検証する。
import assert from "node:assert/strict";
import {
  SMART_FOLDER_TEMPLATES,
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type WorksPage,
} from "@mimimilli/shared";
import {
  defineContract,
  numberedWorks,
  SEED_ADDED_AT,
  type ContractHarness,
} from "./helpers/contractHarness.ts";

const SEED_YEAR = new Date(SEED_ADDED_AT).getUTCFullYear();

const contract = defineContract({
  works: [
    { key: "a", tags: ["cv/x", "ASMR"] },
    { key: "b", tags: ["cv/y"] },
    { key: "c", tags: ["耳かき"] },
  ],
});
const emptyLibrary = defineContract({ works: [] });
const pagedLibrary = defineContract({
  works: numberedWorks(WORKS_DEFAULT_PAGE_SIZE + 10, ["ASMR"]),
});

const SEEDED_IDS = SMART_FOLDER_TEMPLATES.filter((t) => t.seeded).map((t) => t.id);
const EMPTY = { type: "and", children: [] };
const write = (name: string, condition: unknown = EMPTY, extra: object = {}) => ({
  name,
  condition,
  sort: "added-desc",
  groupBy: null,
  groupSort: null,
  ...extra,
});

async function list(harness: ContractHarness): Promise<SmartFolder[]> {
  const { status, body } = await harness.json<SmartFolder[]>("/api/smart-folders");
  assert.equal(status, 200);
  return body;
}

async function create(harness: ContractHarness, name: string, condition?: unknown) {
  const res = await harness.send<SmartFolder>("POST", "/api/smart-folders", write(name, condition));
  assert.equal(res.status, 201);
  return res.body;
}

async function counts(harness: ContractHarness): Promise<Record<string, number>> {
  const { status, body } = await harness.json<Record<string, number>>("/api/smart-folders/counts");
  assert.equal(status, 200);
  return body;
}

contract("一覧は既定が順に並び、定義だけで件数を含まない", async (harness) => {
  const folders = await list(harness);
  assert.deepEqual(
    folders.map((f) => f.id),
    SEEDED_IDS,
  );
  assert.deepEqual(
    folders.map((f) => f.position),
    folders.map((_, i) => i),
  );
  for (const folder of folders) assert.ok(!("count" in folder), folder.id);
});

contract("件数は出すものと隠す判定が要るものだけ GET /counts に入る", async (harness) => {
  assert.deepEqual(await counts(harness), {
    recent: 0,
    added: 3,
    fav: 0,
    error: 0,
  });
});

emptyLibrary("空のライブラリでは件数が0になる", async (harness) => {
  assert.deepEqual(await counts(harness), {
    recent: 0,
    added: 0,
    fav: 0,
    error: 0,
  });
});

contract(
  "エラーだけを条件にするグループ分け付きの行も、隠す判定のために数える",
  async (harness) => {
    const created = await harness.send<SmartFolder>(
      "POST",
      "/api/smart-folders",
      write(
        "エラー別",
        { type: "and", children: [{ type: "hasError" }] },
        { groupBy: { kind: "tag" }, groupSort: "count-desc" },
      ),
    );
    assert.equal(created.status, 201);
    assert.equal((await counts(harness))[created.body.id], 0);
  },
);

const patch = (harness: ContractHarness, id: string, body: unknown) =>
  harness.send<SmartFolder>("PATCH", `/api/smart-folders/${id}`, body);
const GROUPED = { groupBy: { kind: "addedYear" }, groupSort: "name-desc" };

contract("作成は sf-<uuid> を採番して末尾に追加し、保存できない条件は400", async (harness) => {
  const created = await create(harness, "cv/x だけ", {
    type: "and",
    children: [{ type: "tag", tag: "CV/x" }],
  });
  assert.match(created.id, /^sf-[0-9a-f-]{36}$/);
  assert.equal(created.position, SEEDED_IDS.length);
  assert.deepEqual(created.condition, { type: "and", children: [{ type: "tag", tag: "cv/x" }] });
  assert.equal((await counts(harness))[created.id], 1);
  assert.equal((await list(harness)).at(-1)!.id, created.id);

  for (const condition of [{ type: "or", children: [] }, { type: "nope" }, null]) {
    const bad = await harness.send("POST", "/api/smart-folders", write("不正", condition));
    assert.equal(bad.status, 400);
  }
  const noSort = await harness.send("POST", "/api/smart-folders", {
    name: "x",
    condition: EMPTY,
    groupBy: null,
  });
  assert.equal(noSort.status, 400);
});

contract("作成は任意の id と position を受け、既存の id は409、形式違反は400", async (harness) => {
  const before = await list(harness);
  const custom = await harness.send<SmartFolder>(
    "POST",
    "/api/smart-folders",
    write("自分で ID", EMPTY, { id: "my-folder-1", position: 1 }),
  );
  assert.equal(custom.status, 201);
  assert.equal(custom.body.id, "my-folder-1");
  assert.equal(custom.body.position, 1);
  const after = await list(harness);
  assert.deepEqual(
    after.map((f) => f.id),
    [before[0]!.id, "my-folder-1", ...before.slice(1).map((f) => f.id)],
  );

  const dup = await harness.send("POST", "/api/smart-folders", write("重複", EMPTY, { id: "fav" }));
  assert.equal(dup.status, 409);
  for (const id of ["Upper", "a/b", "", "a".repeat(65), "全角", "sf_underscore"]) {
    const res = await harness.send("POST", "/api/smart-folders", write("不正", EMPTY, { id }));
    assert.equal(res.status, 400, JSON.stringify(id));
  }
  const badPosition = await harness.send(
    "POST",
    "/api/smart-folders",
    write("x", EMPTY, { position: -1 }),
  );
  assert.equal(badPosition.status, 400);
});

contract("削除した行は同じ ID・位置・作成日時を送って POST で戻せる", async (harness) => {
  const created = await create(harness, "戻す", {
    type: "and",
    children: [{ type: "tag", tag: "cv/x" }],
  });
  await create(harness, "後ろ");
  const before = await list(harness);
  await harness.request(`/api/smart-folders/${created.id}`, { method: "DELETE" });

  const { createdAt: _createdAt, ...row } = created;
  const restored = await harness.send<SmartFolder>("POST", "/api/smart-folders", row);
  assert.equal(restored.status, 201);
  assert.equal(restored.body.id, created.id);
  assert.equal(restored.body.position, created.position);
  assert.deepEqual(
    (await list(harness)).map((f) => [f.id, f.position]),
    before.map((f) => [f.id, f.position]),
  );
  assert.equal((await harness.send("POST", "/api/smart-folders", row)).status, 409);
});

contract("位置が埋まっていれば、その位置以降を後ろへ送って順序を保つ", async (harness) => {
  const created = await create(harness, "中");
  const tail = await create(harness, "末");
  await harness.request(`/api/smart-folders/${created.id}`, { method: "DELETE" });
  const added = await create(harness, "新");
  assert.equal(added.position, tail.position + 1);
  const { createdAt: _createdAt, ...row } = { ...created, position: tail.position };
  const restored = await harness.send<SmartFolder>("POST", "/api/smart-folders", row);
  assert.equal(restored.body.position, tail.position);
  const ids = (await list(harness)).map((f) => f.id);
  assert.deepEqual(ids.slice(-3), [created.id, tail.id, added.id]);
});

contract("既定から追加は、テンプレートの定義と固定 ID を送って POST で作る", async (harness) => {
  const template = SMART_FOLDER_TEMPLATES.find((t) => t.id === "by-series")!;
  const { id, name, condition, sort, groupBy, groupSort } = template;
  const added = await harness.send<SmartFolder>("POST", "/api/smart-folders", {
    id,
    name,
    condition,
    sort,
    groupBy,
    groupSort,
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.id, "by-series");
  assert.deepEqual(added.body.groupBy, { kind: "prefix", prefix: "シリーズ" });
  assert.equal(added.body.groupSort, "count-desc");
  assert.equal(added.body.sort, "title-asc");
  assert.equal(added.body.position, SEEDED_IDS.length);
});

contract("条件の木の子は100個まで、入れ子は1段までで、超えたら400", async (harness) => {
  const tags = (n: number) => Array.from({ length: n }, (_, i) => ({ type: "tag", tag: `t/${i}` }));
  const rejected = async (condition: unknown) => {
    const res = await harness.send("POST", "/api/smart-folders", write("x", condition));
    assert.equal(res.status, 400, JSON.stringify(condition).slice(0, 80));
  };
  assert.equal(
    (
      await harness.send(
        "POST",
        "/api/smart-folders",
        write("100", { type: "and", children: tags(100) }),
      )
    ).status,
    201,
  );
  await rejected({ type: "and", children: tags(101) });
  await rejected({ type: "and", children: [{ type: "or", children: tags(101) }] });
  await rejected({
    type: "and",
    children: [{ type: "not", child: { type: "or", children: tags(101) } }],
  });
  await rejected({
    type: "and",
    children: [{ type: "or", children: [{ type: "or", children: tags(2) }] }],
  });
  await rejected({
    type: "and",
    children: [{ type: "not", child: { type: "not", child: { type: "tag", tag: "a" } } }],
  });

  const deep = '{"type":"not","child":'.repeat(20000) + '{"type":"bookmarked"}' + "}".repeat(20000);
  for (const [method, path] of [
    ["POST", "/api/smart-folders"],
    ["PATCH", "/api/smart-folders/fav"],
  ] as const) {
    const body =
      method === "POST"
        ? `{"name":"x","sort":null,"groupBy":null,"groupSort":null,"condition":{"type":"and","children":[${deep}]}}`
        : `{"condition":{"type":"and","children":[${deep}]}}`;
    const res = await harness.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body,
    });
    assert.equal(res.status, 400, `${method} ${path}`);
  }
});

contract("チップは100個まで。超えたら作品一覧も値一覧も400", async (harness) => {
  const tags = (n: number) => Array.from({ length: n }, (_, i) => `t/${i}`);
  const query = (n: number) =>
    tags(n)
      .map((tag) => `tags=${encodeURIComponent(tag)}`)
      .join("&");
  const works = (n: number) =>
    harness.request(`/api/smart-folders/all/works?sort=added-desc&${query(n)}`);
  assert.equal((await works(100)).status, 200);
  assert.equal((await works(101)).status, 400);
  const groups = (n: number) =>
    harness.request(`/api/smart-folders/all/groups?groupBy=tag&groupSort=count-desc&${query(n)}`);
  assert.equal((await groups(100)).status, 200);
  assert.equal((await groups(101)).status, 400);
});

contract("更新は PATCH で、送った列だけを書き、ほかの列を巻き戻さない", async (harness) => {
  const created = await create(harness, "元", { type: "and", children: [{ type: "bookmarked" }] });
  // 別の画面での更新が先に入っていても、送らなかった列は巻き戻さない
  await patch(harness, created.id, { name: "別タブで改名", sort: "title-asc" });

  const tag = { type: "and", children: [{ type: "tag", tag: "ASMR" }] };
  const res = await patch(harness, created.id, { condition: tag });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.condition, tag);
  assert.equal(res.body.name, "別タブで改名");
  assert.equal(res.body.sort, "title-asc");
  assert.equal(res.body.createdAt, created.createdAt);
  assert.equal(res.body.position, created.position);

  const inherit = await patch(harness, created.id, { sort: null });
  assert.equal(inherit.body.sort, null);
  assert.deepEqual(inherit.body.condition, tag);

  const grouped = await patch(harness, created.id, GROUPED);
  assert.equal(grouped.status, 200);
  assert.deepEqual(grouped.body.groupBy, { kind: "addedYear" });
  assert.equal(grouped.body.groupSort, "name-desc");
  assert.equal(grouped.body.name, "別タブで改名");

  const resorted = await patch(harness, created.id, { groupSort: "last-played" });
  assert.equal(resorted.body.groupSort, "last-played");
  assert.deepEqual(resorted.body.groupBy, { kind: "addedYear" });

  const ungrouped = await patch(harness, created.id, { groupBy: null, groupSort: null });
  assert.equal(ungrouped.body.groupBy, null);
  assert.equal(ungrouped.body.groupSort, null);
  assert.equal((await list(harness)).find((f) => f.id === created.id)!.name, "別タブで改名");
});

contract("更新は今の行に重ねた形を adapter の中で検証し、違反なら書かない", async (harness) => {
  const plain = await create(harness, "なし");
  const result = await harness.adapter.updateSmartFolder(plain.id, { groupSort: "count-desc" });
  assert.ok(result && "violation" in result);
  assert.equal((await harness.adapter.getSmartFolder(plain.id))?.groupSort, null);
});

contract("PATCH は不正な本文・無い行を弾く", async (harness) => {
  const created = await create(harness, "雨");
  assert.equal((await patch(harness, created.id, {})).status, 400);
  assert.equal((await patch(harness, created.id, { condition: { type: "nope" } })).status, 400);
  assert.equal((await patch(harness, created.id, { sort: "x" })).status, 400);
  assert.equal((await patch(harness, created.id, { name: " " })).status, 400);
  assert.equal((await patch(harness, created.id, { position: 3 })).status, 400);
  assert.equal((await patch(harness, created.id, { id: "other" })).status, 400);
  assert.equal((await patch(harness, "sf-nope", { name: "x" })).status, 404);
  assert.equal(
    (await harness.send("PUT", `/api/smart-folders/${created.id}`, write("x"))).status,
    404,
  );
  assert.equal(
    (await harness.send("PUT", `/api/smart-folders/${created.id}/sort`, { sort: null })).status,
    404,
  );
});

contract(
  "グループ分けと値の並びの組が合わない作成・更新は400で、行は変わらない",
  async (harness) => {
    const grouped = { groupBy: { kind: "tag" } };
    for (const body of [
      write("a", EMPTY, grouped),
      write("b", EMPTY, { groupSort: "count-desc" }),
      write("c", EMPTY, { ...grouped, groupSort: "nope" }),
    ]) {
      assert.equal((await harness.send("POST", "/api/smart-folders", body)).status, 400);
    }
    const plain = await create(harness, "なし");
    assert.equal((await patch(harness, plain.id, { groupSort: "count-desc" })).status, 400);
    assert.equal((await patch(harness, plain.id, grouped)).status, 400);

    const withGroup = await harness.send<SmartFolder>(
      "POST",
      "/api/smart-folders",
      write("年別", EMPTY, GROUPED),
    );
    assert.equal(withGroup.status, 201);
    assert.equal((await patch(harness, withGroup.body.id, { groupBy: null })).status, 400);
    assert.equal((await patch(harness, withGroup.body.id, { groupSort: null })).status, 400);
    assert.equal((await patch(harness, withGroup.body.id, { groupSort: "random" })).status, 400);
    const after = (await list(harness)).find((f) => f.id === withGroup.body.id)!;
    assert.deepEqual(after.groupBy, { kind: "addedYear" });
    assert.equal(after.groupSort, "name-desc");
  },
);

contract("既定の行は自作と同じに変えられる", async (harness) => {
  const renamed = await patch(harness, "recent", {
    name: "最近",
    condition: { type: "and", children: [{ type: "bookmarked" }] },
    sort: "title-asc",
    ...GROUPED,
  });
  assert.equal(renamed.status, 200);
  assert.equal(renamed.body.name, "最近");
  assert.deepEqual(renamed.body.groupBy, { kind: "addedYear" });
  assert.equal(
    (await patch(harness, "by-cv", { groupSort: "name-asc" })).body.groupSort,
    "name-asc",
  );
  assert.equal((await patch(harness, "by-cv", { groupBy: { kind: "tag" } })).status, 200);
  assert.equal((await list(harness)).find((f) => f.id === "by-year")!.groupSort, "name-desc");
});

contract(
  "「すべて」は並びだけ変えられ、名前・条件・グループ分け・空の並びは400",
  async (harness) => {
    const bad: unknown[] = [
      { name: "全部" },
      { condition: { type: "and", children: [{ type: "bookmarked" }] } },
      GROUPED,
      { sort: null },
    ];
    for (const body of bad) {
      assert.equal((await patch(harness, "all", body)).status, 400, JSON.stringify(body));
    }
    const sorted = await patch(harness, "all", { sort: "title-asc" });
    assert.equal(sorted.status, 200);
    assert.equal(sorted.body.sort, "title-asc");
    assert.equal(sorted.body.name, "すべて");

    const del = await harness.request("/api/smart-folders/all", { method: "DELETE" });
    assert.equal(del.status, 400);
    assert.ok((await list(harness)).some((f) => f.id === "all"));
  },
);

contract("消した「すべて」は、保存できる形のときだけ POST で戻せる", async (harness) => {
  const all = (await list(harness)).find((f) => f.id === "all")!;
  const { createdAt: _createdAt, ...row } = all;
  // 一時的に「すべて」が無い状態は、adapter を直接触って作る
  await harness.adapter.deleteSmartFolder("all");
  for (const bad of [
    { ...row, name: "全部" },
    { ...row, sort: null },
    { ...row, condition: { type: "and", children: [{ type: "bookmarked" }] } },
    { ...row, ...GROUPED },
  ]) {
    assert.equal((await harness.send("POST", "/api/smart-folders", bad)).status, 400);
  }
  const ok = await harness.send<SmartFolder>("POST", "/api/smart-folders", row);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.id, "all");
});

contract("削除は既定のものも可能で、無い ID は404", async (harness) => {
  const del = await harness.request("/api/smart-folders/fav", { method: "DELETE" });
  assert.equal(del.status, 204);
  assert.ok(!(await list(harness)).some((f) => f.id === "fav"));
  const again = await harness.request("/api/smart-folders/fav", { method: "DELETE" });
  assert.equal(again.status, 404);
});

contract("並べ替えは全件の順序を置き換え、過不足があれば400", async (harness) => {
  const ids = (await list(harness)).map((f) => f.id);
  const reversed = [...ids].reverse();
  const put = await harness.send<SmartFolder[]>("PUT", "/api/smart-folders/order", {
    ids: reversed,
  });
  assert.equal(put.status, 200);
  assert.deepEqual(
    put.body.map((f) => f.id),
    reversed,
  );
  assert.deepEqual(
    (await list(harness)).map((f) => f.id),
    reversed,
  );

  for (const bad of [ids.slice(1), [...ids, "sf-nope"], [...ids.slice(1), ids[1]!]]) {
    const res = await harness.send("PUT", "/api/smart-folders/order", { ids: bad });
    assert.equal(res.status, 400);
  }
});

contract("値一覧は groupSort の並びで返り、groupSort の省略は400", async (harness) => {
  const names = async (groupSort: string) => {
    const res = await harness.json<Array<{ value: string; sortKey: string }>>(
      `/api/smart-folders/all/groups?groupBy=prefix:cv&groupSort=${groupSort}`,
    );
    assert.equal(res.status, 200);
    return res.body.map((item) => item.value);
  };
  assert.deepEqual(await names("name-asc"), ["x", "y"]);
  assert.deepEqual(await names("name-desc"), ["y", "x"]);
  assert.equal(
    (await harness.request("/api/smart-folders/all/groups?groupBy=prefix:cv")).status,
    400,
  );
  assert.equal(
    (await harness.request("/api/smart-folders/by-cv/groups?groupSort=count-desc")).status,
    400,
  );
  const bad = await harness.request("/api/smart-folders/all/groups?groupBy=tag&groupSort=random");
  assert.equal(bad.status, 400);
});

contract("作品一覧は条件・チップ・検索語・グループの値を AND で評価する", async (harness) => {
  const folder = await create(harness, "cv", {
    type: "and",
    children: [{ type: "hasPrefix", prefix: "cv" }],
  });
  const works = await harness.json<WorksPage>(
    `/api/smart-folders/${folder.id}/works?sort=title-asc`,
  );
  assert.equal(works.status, 200);
  assert.equal(works.body.total, 2);

  const chip = await harness.json<WorksPage>(
    `/api/smart-folders/${folder.id}/works?sort=title-asc&tags=${encodeURIComponent("cv/x")}`,
  );
  assert.deepEqual(
    chip.body.items.map((w) => w.id),
    [harness.workId("a")],
  );

  const q = await harness.json<WorksPage>(
    `/api/smart-folders/${folder.id}/works?sort=title-asc&q=b`,
  );
  assert.deepEqual(
    q.body.items.map((w) => w.id),
    [harness.workId("b")],
  );

  const padded = await harness.json<WorksPage>(
    `/api/smart-folders/${folder.id}/works?sort=title-asc&q=%20%20b%20`,
  );
  assert.deepEqual(
    padded.body.items.map((w) => w.id),
    [harness.workId("b")],
  );
  const blank = await harness.json<WorksPage>(
    `/api/smart-folders/${folder.id}/works?sort=title-asc&q=%20%20`,
  );
  assert.equal(blank.body.total, 2);

  const byCv = await harness.json<WorksPage>(
    `/api/smart-folders/by-cv/works?sort=title-asc&group=y`,
  );
  assert.deepEqual(
    byCv.body.items.map((w) => w.id),
    [harness.workId("b")],
  );
});

contract(
  "作品一覧の要求が契約に合わなければ400（契約にないキー・seed なしの random・不正な @ タグ）",
  async (harness) => {
    for (const query of [
      "sort=added-desc&tags=cv%2Fx&tagMode=OR",
      "sort=random",
      "sort=added-desc&tags=%40year%2F",
      "sort=added-desc&page=0",
      "",
      "sort=added-desc&group=x",
    ]) {
      const res = await harness.json(`/api/smart-folders/all/works?${query}`);
      assert.equal(res.status, 400, query);
      assert.equal(res.body.error.code, "invalid_request", query);
    }
    const missing = await harness.json("/api/smart-folders/sf-nope/works?sort=added-desc");
    assert.equal(missing.status, 404);
  },
);

contract("random は seed を送れば作品一覧を返す", async (harness) => {
  const res = await harness.json<WorksPage>("/api/smart-folders/random/works?sort=random&seed=7");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, 3);
});

const groupsLibrary = defineContract({
  works: [
    { key: "a", tags: ["cv/x", "ASMR"] },
    { key: "b", tags: ["cv/y", "ASMR"] },
    { key: "c", tags: ["cv/y", "耳かき"] },
  ],
});

type GroupItems = Array<{ value: string; count: number }>;

interface GroupsParams {
  groupBy?: string;
  tags?: string[];
}

async function groupPairs(harness: ContractHarness, folderId: string, params: GroupsParams) {
  const query = new URLSearchParams({ groupSort: "count-desc" });
  if (params.groupBy) query.set("groupBy", params.groupBy);
  for (const tag of params.tags ?? []) query.append("tags", tag);
  const res = await harness.json<GroupItems>(`/api/smart-folders/${folderId}/groups?${query}`);
  assert.equal(res.status, 200);
  return res.body.map((item) => [item.value, item.count]);
}

groupsLibrary(
  "値一覧は件数の多い順で、同数なら読み→値のバイト順。自身の groupBy でも任意の groupBy でも同じ口で取れる",
  async (harness) => {
    assert.deepEqual(await groupPairs(harness, "by-cv", { groupBy: "prefix:cv" }), [
      ["y", 2],
      ["x", 1],
    ]);
    assert.deepEqual(await groupPairs(harness, "all", { groupBy: "tag" }), [
      ["ASMR", 2],
      ["cv/y", 2],
      ["cv/x", 1],
      ["耳かき", 1],
    ]);
    assert.deepEqual(await groupPairs(harness, "all", { groupBy: "addedYear" }), [
      [String(SEED_YEAR), 3],
    ]);
  },
);

groupsLibrary("値一覧はチップ・@year で母集団を絞る", async (harness) => {
  const year = SEED_YEAR;
  assert.deepEqual(await groupPairs(harness, "all", { groupBy: "tag", tags: ["cv/y"] }), [
    ["cv/y", 2],
    ["ASMR", 1],
    ["耳かき", 1],
  ]);
  assert.deepEqual(await groupPairs(harness, "all", { groupBy: "prefix:cv", tags: ["ASMR"] }), [
    ["x", 1],
    ["y", 1],
  ]);
  assert.deepEqual(
    await groupPairs(harness, "all", { groupBy: "prefix:cv", tags: [`@year/${year}`] }),
    [
      ["y", 2],
      ["x", 1],
    ],
  );
  assert.deepEqual(
    await groupPairs(harness, "all", { groupBy: "tag", tags: [`@year/${year - 1}`] }),
    [],
  );
});

contract("値一覧の要求が契約に合わなければ400、無いスマートフォルダーは404", async (harness) => {
  const bad = await harness.request(
    "/api/smart-folders/all/groups?groupBy=nope&groupSort=count-desc",
  );
  assert.equal(bad.status, 400);
  const missing = await harness.request(
    "/api/smart-folders/sf-nope/groups?groupBy=tag&groupSort=count-desc",
  );
  assert.equal(missing.status, 404);
});

pagedLibrary("作品一覧はページで連結すると重複・欠落なく取れる", async (harness) => {
  const total = WORKS_DEFAULT_PAGE_SIZE + 10;
  const first = await harness.json<WorksPage>(
    "/api/smart-folders/all/works?sort=added-desc&limit=200&page=1",
  );
  const second = await harness.json<WorksPage>(
    "/api/smart-folders/all/works?sort=added-desc&limit=200&page=2",
  );
  const ids = [...first.body.items, ...second.body.items].map((w) => w.id);
  assert.equal(new Set(ids).size, total);
  assert.equal(ids.length, total);
  assert.equal(second.body.total, total);

  const random1 = await harness.json<WorksPage>(
    "/api/smart-folders/random/works?sort=random&seed=3&limit=200&page=1",
  );
  const random2 = await harness.json<WorksPage>(
    "/api/smart-folders/random/works?sort=random&seed=3&limit=200&page=2",
  );
  const randomIds = [...random1.body.items, ...random2.body.items].map((w) => w.id);
  assert.equal(new Set(randomIds).size, total);
});

pagedLibrary("limit を省くと WORKS_DEFAULT_PAGE_SIZE 件になる", async (harness) => {
  const res = await harness.json<WorksPage>("/api/smart-folders/all/works?sort=added-desc");
  assert.equal(res.status, 200);
  assert.equal(res.body.items.length, WORKS_DEFAULT_PAGE_SIZE);
  assert.equal(res.body.total, WORKS_DEFAULT_PAGE_SIZE + 10);
});
