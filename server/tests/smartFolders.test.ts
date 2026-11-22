// /api/smart-folders 以下の契約（ADR-0040）を fixture / real の両方で検証する。
import assert from "node:assert/strict";
import {
  SMART_FOLDER_TEMPLATES,
  WORKS_DEFAULT_PAGE_SIZE,
  type SmartFolder,
  type WorksPage,
} from "@mimimilli/shared";
import { defineContract, numberedWorks, type ContractHarness } from "./helpers/contractHarness.ts";

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

contract("一覧は既定が順に並び、件数は出すものと隠す判定が要るものだけ入る", async (harness) => {
  const folders = await list(harness);
  assert.deepEqual(
    folders.map((f) => f.id),
    SEEDED_IDS,
  );
  assert.deepEqual(
    folders.map((f) => f.position),
    folders.map((_, i) => i),
  );
  const count = (id: string) => folders.find((f) => f.id === id)!.count;
  assert.equal(count("all"), null);
  assert.equal(count("random"), null);
  assert.equal(count("by-cv"), null);
  assert.equal(count("recent"), 0);
  assert.equal(count("added"), 3);
  assert.equal(count("fav"), 0);
  assert.equal(count("error"), 0);
});

emptyLibrary("空のライブラリでは件数が0になる", async (harness) => {
  const folders = await list(harness);
  for (const id of ["recent", "added", "fav", "error"]) {
    assert.equal(folders.find((f) => f.id === id)!.count, 0, id);
  }
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
        { groupBy: { kind: "tag" } },
      ),
    );
    assert.equal(created.status, 201);
    assert.equal(created.body.count, 0);
  },
);

contract("作成は sf-<uuid> を採番して末尾に追加し、保存できない条件は400", async (harness) => {
  const created = await create(harness, "cv/x だけ", {
    type: "and",
    children: [{ type: "tag", tag: "CV/x" }],
  });
  assert.match(created.id, /^sf-[0-9a-f-]{36}$/);
  assert.equal(created.position, SEEDED_IDS.length);
  assert.deepEqual(created.condition, { type: "and", children: [{ type: "tag", tag: "cv/x" }] });
  assert.equal(created.count, 1);
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

contract("更新は名前・条件・並び・グループ分けを置き換える", async (harness) => {
  const created = await create(harness, "元");
  const put = await harness.send<SmartFolder>(
    "PUT",
    `/api/smart-folders/${created.id}`,
    write(
      "先",
      { type: "and", children: [{ type: "bookmarked" }] },
      { sort: null, groupBy: { kind: "addedYear" } },
    ),
  );
  assert.equal(put.status, 200);
  assert.equal(put.body.name, "先");
  assert.equal(put.body.sort, null);
  assert.deepEqual(put.body.groupBy, { kind: "addedYear" });
  assert.equal(put.body.createdAt, created.createdAt);
  assert.equal(put.body.position, created.position);

  const missing = await harness.send("PUT", "/api/smart-folders/sf-nope", write("x"));
  assert.equal(missing.status, 404);
});

contract(
  "既定の並びだけの更新は、ほかの列を触らず、「すべて」の並びは空にできない",
  async (harness) => {
    const created = await create(harness, "自作", {
      type: "and",
      children: [{ type: "bookmarked" }],
    });
    const renamed = await harness.send<SmartFolder>("PUT", `/api/smart-folders/${created.id}`, {
      name: "別タブで改名",
      condition: { type: "and", children: [{ type: "played" }] },
      sort: "added-desc",
      groupBy: { kind: "addedYear" },
    });
    assert.equal(renamed.status, 200);

    const res = await harness.send<SmartFolder>("PUT", `/api/smart-folders/${created.id}/sort`, {
      sort: "title-asc",
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.sort, "title-asc");
    assert.equal(res.body.name, "別タブで改名");
    assert.deepEqual(res.body.condition, { type: "and", children: [{ type: "played" }] });
    assert.deepEqual(res.body.groupBy, { kind: "addedYear" });

    const inherit = await harness.send<SmartFolder>(
      "PUT",
      `/api/smart-folders/${created.id}/sort`,
      {
        sort: null,
      },
    );
    assert.equal(inherit.status, 200);
    assert.equal(inherit.body.sort, null);

    const all = await harness.send("PUT", "/api/smart-folders/all/sort", { sort: null });
    assert.equal(all.status, 400);
    const allOk = await harness.send<SmartFolder>("PUT", "/api/smart-folders/all/sort", {
      sort: "title-asc",
    });
    assert.equal(allOk.status, 200);
    assert.equal(allOk.body.sort, "title-asc");
    assert.equal(
      (await harness.send("PUT", "/api/smart-folders/sf-nope/sort", { sort: null })).status,
      404,
    );
    assert.equal(
      (await harness.send("PUT", `/api/smart-folders/${created.id}/sort`, { sort: "x" })).status,
      400,
    );
  },
);

contract("壊れた行への既定の並びだけの更新は 403 で、並びは書き換わらない", async (harness) => {
  const created = await create(harness, "壊れる");
  const original = harness.adapter.getSmartFolder.bind(harness.adapter);
  harness.adapter.getSmartFolder = async (id) => {
    const row = await original(id);
    return row && id === created.id ? { ...row, condition: null, sort: null, groupBy: null } : row;
  };
  try {
    const res = await harness.send("PUT", `/api/smart-folders/${created.id}/sort`, {
      sort: "title-asc",
    });
    assert.equal(res.status, 403);
  } finally {
    harness.adapter.getSmartFolder = original;
  }
  assert.equal((await list(harness)).find((f) => f.id === created.id)!.sort, "added-desc");
});

contract("既定のものは名前・既定の並びだけ変えられ、条件とグループ分けは弾く", async (harness) => {
  const recent = (await list(harness)).find((f) => f.id === "recent")!;
  const ok = await harness.send<SmartFolder>("PUT", "/api/smart-folders/recent", {
    name: "最近",
    condition: recent.condition,
    sort: "title-asc",
    groupBy: null,
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.name, "最近");
  assert.equal(ok.body.sort, "title-asc");

  const condition = await harness.send("PUT", "/api/smart-folders/recent", write("最近"));
  assert.equal(condition.status, 403);
  const groupBy = await harness.send("PUT", "/api/smart-folders/recent", {
    ...write("最近", recent.condition),
    groupBy: { kind: "tag" },
  });
  assert.equal(groupBy.status, 403);
  const byCv = (await list(harness)).find((f) => f.id === "by-cv")!;
  const regroup = await harness.send("PUT", "/api/smart-folders/by-cv", {
    ...write("CV別", byCv.condition),
    groupBy: { kind: "tag" },
  });
  assert.equal(regroup.status, 403);
});

contract(
  "「すべて」は名前・条件の変更と削除ができず、既定の並びは空にできない",
  async (harness) => {
    const rename = await harness.send("PUT", "/api/smart-folders/all", write("全部"));
    assert.equal(rename.status, 403);
    const condition = await harness.send(
      "PUT",
      "/api/smart-folders/all",
      write("すべて", {
        type: "and",
        children: [{ type: "bookmarked" }],
      }),
    );
    assert.equal(condition.status, 403);
    const nullSort = await harness.send(
      "PUT",
      "/api/smart-folders/all",
      write("すべて", EMPTY, { sort: null }),
    );
    assert.equal(nullSort.status, 400);
    const sort = await harness.send<SmartFolder>(
      "PUT",
      "/api/smart-folders/all",
      write("すべて", EMPTY, { sort: "title-asc" }),
    );
    assert.equal(sort.status, 200);
    assert.equal(sort.body.sort, "title-asc");

    const del = await harness.request("/api/smart-folders/all", { method: "DELETE" });
    assert.equal(del.status, 403);
    assert.ok((await list(harness)).some((f) => f.id === "all"));
  },
);

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

contract("テンプレートから固定 ID で追加でき、今ある ID は409", async (harness) => {
  const dup = await harness.send("POST", "/api/smart-folders/from-template", { templateId: "fav" });
  assert.equal(dup.status, 409);

  await harness.request("/api/smart-folders/fav", { method: "DELETE" });
  const added = await harness.send<SmartFolder>("POST", "/api/smart-folders/from-template", {
    templateId: "fav",
  });
  assert.equal(added.status, 201);
  assert.equal(added.body.id, "fav");
  assert.equal(added.body.name, "お気に入り");
  assert.equal(added.body.position, SEEDED_IDS.length);

  const series = await harness.send<SmartFolder>("POST", "/api/smart-folders/from-template", {
    templateId: "by-series",
  });
  assert.equal(series.status, 201);
  assert.deepEqual(series.body.groupBy, { kind: "prefix", prefix: "シリーズ" });

  const unknown = await harness.send("POST", "/api/smart-folders/from-template", {
    templateId: "nope",
  });
  assert.equal(unknown.status, 400);
});

contract("削除した行を同じ ID・位置・作成日時で戻せる", async (harness) => {
  const created = await create(harness, "戻す", {
    type: "and",
    children: [{ type: "tag", tag: "cv/x" }],
  });
  await create(harness, "後ろ");
  const before = await list(harness);
  await harness.request(`/api/smart-folders/${created.id}`, { method: "DELETE" });

  const { count: _count, ...row } = created;
  const restored = await harness.send<SmartFolder>("POST", "/api/smart-folders/restore", row);
  assert.equal(restored.status, 201);
  assert.deepEqual(restored.body, created);
  assert.deepEqual(
    (await list(harness)).map((f) => [f.id, f.position, f.createdAt]),
    before.map((f) => [f.id, f.position, f.createdAt]),
  );

  const exists = await harness.send("POST", "/api/smart-folders/restore", row);
  assert.equal(exists.status, 409);
});

contract("復元は位置が埋まっていれば後ろへ送り、順序を保つ", async (harness) => {
  const created = await create(harness, "中");
  const tail = await create(harness, "末");
  await harness.request(`/api/smart-folders/${created.id}`, { method: "DELETE" });
  const reordered = await create(harness, "新");
  assert.equal(reordered.position, tail.position + 1);
  const { count: _count, ...row } = { ...created, position: tail.position };
  const restored = await harness.send<SmartFolder>("POST", "/api/smart-folders/restore", row);
  assert.equal(restored.status, 201);
  assert.equal(restored.body.position, tail.position);
  const ids = (await list(harness)).map((f) => f.id);
  assert.deepEqual(ids.slice(-3), [created.id, tail.id, reordered.id]);
});

contract(
  "既定の ID の復元は条件・グループ分けがテンプレートと一致するときだけ通る",
  async (harness) => {
    const fav = (await list(harness)).find((f) => f.id === "fav")!;
    await harness.request("/api/smart-folders/fav", { method: "DELETE" });
    const { count: _count, ...row } = fav;

    const tampered = await harness.send("POST", "/api/smart-folders/restore", {
      ...row,
      condition: EMPTY,
    });
    assert.equal(tampered.status, 400);
    const regrouped = await harness.send("POST", "/api/smart-folders/restore", {
      ...row,
      groupBy: { kind: "tag" },
    });
    assert.equal(regrouped.status, 400);
    const renamed = await harness.send<SmartFolder>("POST", "/api/smart-folders/restore", {
      ...row,
      name: "好き",
      sort: "title-asc",
    });
    assert.equal(renamed.status, 201);
    assert.equal(renamed.body.id, "fav");
    assert.equal(renamed.body.position, fav.position);

    const all = await harness.send("POST", "/api/smart-folders/restore", { ...row, id: "all" });
    assert.equal(all.status, 400);
    const unknownId = await harness.send("POST", "/api/smart-folders/restore", {
      ...row,
      id: "something",
    });
    assert.equal(unknownId.status, 400);
  },
);

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

async function groupPairs(harness: ContractHarness, folderId: string, body: unknown) {
  const res = await harness.send<GroupItems>("POST", `/api/smart-folders/${folderId}/groups`, body);
  assert.equal(res.status, 200);
  return res.body.map((item) => [item.value, item.count]);
}

groupsLibrary(
  "値一覧は件数の多い順で、同数なら値のバイト順。自身の groupBy でも任意の groupBy でも同じ口で取れる",
  async (harness) => {
    assert.deepEqual(
      await groupPairs(harness, "by-cv", { groupBy: { kind: "prefix", prefix: "cv" } }),
      [
        ["y", 2],
        ["x", 1],
      ],
    );
    assert.deepEqual(await groupPairs(harness, "all", { groupBy: { kind: "tag" } }), [
      ["ASMR", 2],
      ["cv/y", 2],
      ["cv/x", 1],
      ["耳かき", 1],
    ]);
    assert.deepEqual(await groupPairs(harness, "all", { groupBy: { kind: "addedYear" } }), [
      [String(new Date().getFullYear()), 3],
    ]);
  },
);

groupsLibrary("値一覧はチップ・@year で母集団を絞る", async (harness) => {
  const year = new Date().getFullYear();
  assert.deepEqual(await groupPairs(harness, "all", { groupBy: { kind: "tag" }, tags: ["cv/y"] }), [
    ["cv/y", 2],
    ["ASMR", 1],
    ["耳かき", 1],
  ]);
  assert.deepEqual(
    await groupPairs(harness, "all", {
      groupBy: { kind: "prefix", prefix: "cv" },
      tags: ["ASMR"],
    }),
    [
      ["x", 1],
      ["y", 1],
    ],
  );
  assert.deepEqual(
    await groupPairs(harness, "all", {
      groupBy: { kind: "prefix", prefix: "cv" },
      tags: [`@year/${year}`],
    }),
    [
      ["y", 2],
      ["x", 1],
    ],
  );
  assert.deepEqual(
    await groupPairs(harness, "all", { groupBy: { kind: "tag" }, tags: [`@year/${year - 1}`] }),
    [],
  );
});

contract("値一覧の要求が契約に合わなければ400、無いスマートフォルダーは404", async (harness) => {
  const bad = await harness.send("POST", "/api/smart-folders/all/groups", {
    groupBy: { kind: "nope" },
  });
  assert.equal(bad.status, 400);
  const missing = await harness.send("POST", "/api/smart-folders/sf-nope/groups", {
    groupBy: { kind: "tag" },
  });
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
