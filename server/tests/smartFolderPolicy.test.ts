// スマートフォルダーの編集権限（ADR-0040）。UI が使う shared の規則と、サーバーの検証が一致することを縛る。
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conditionViolation,
  groupSortViolation,
  smartFolderPermissions,
  sortViolation,
  updateViolation,
  type SmartFolder,
  type SmartFolderWrite,
} from "@mimimilli/shared";
import { defineContract, type ContractHarness } from "./helpers/contractHarness.ts";

const EMPTY = { type: "and" as const, children: [] };
const folder = (id: string): SmartFolder => ({
  id,
  name: id,
  condition: EMPTY,
  sort: null,
  groupBy: null,
  groupSort: null,
  position: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  count: null,
});

test("自作は何でも変えられる", () => {
  assert.deepEqual(smartFolderPermissions(folder("sf-00000000-0000-4000-8000-000000000001")), {
    rename: true,
    editCondition: true,
    editGroupBy: true,
    inheritSort: true,
    remove: true,
  });
});

test("既定は名前・並び・削除だけ。条件とグループ分けは変えられない", () => {
  assert.deepEqual(smartFolderPermissions(folder("by-cv")), {
    rename: true,
    editCondition: false,
    editGroupBy: false,
    inheritSort: true,
    remove: true,
  });
});

test("「すべて」は名前・条件・グループ分け・削除ができず、並びを継承にもできない", () => {
  assert.deepEqual(smartFolderPermissions(folder("all")), {
    rename: false,
    editCondition: false,
    editGroupBy: false,
    inheritSort: false,
    remove: false,
  });
});

test("並びだけの更新の違反: 「すべて」の空は 400 相当", () => {
  assert.equal(sortViolation(folder("all"), null)?.kind, "invalid");
  assert.equal(sortViolation(folder("all"), "title-asc"), null);
  assert.equal(sortViolation(folder("fav"), null), null);
});

test("条件の更新の違反: 既定の行（「すべて」を含む）は 403 相当、自作は通る", () => {
  assert.equal(conditionViolation(folder("fav"))?.kind, "forbidden");
  assert.equal(conditionViolation(folder("all"))?.kind, "forbidden");
  const own = folder("sf-00000000-0000-4000-8000-000000000001");
  assert.equal(conditionViolation(own), null);
});

test("値の並びだけの更新の違反: グループ分けの無い行は 400 相当", () => {
  const grouped = {
    ...folder("by-cv"),
    groupBy: { kind: "tag" } as const,
    groupSort: "count-desc" as const,
  };
  assert.equal(groupSortViolation(grouped), null);
  assert.equal(groupSortViolation(folder("fav"))?.kind, "invalid");
});

test("更新の違反は値で返り、種別は 403 相当と 400 相当に分かれる", () => {
  const write = (patch: Partial<SmartFolderWrite>): SmartFolderWrite => ({
    name: "all",
    condition: EMPTY,
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
    ...patch,
  });
  const all = { id: "all", name: "all" };
  assert.equal(updateViolation(all, write({})), null);
  assert.equal(updateViolation(all, write({ name: "x" }))?.kind, "forbidden");
  assert.equal(updateViolation(all, write({ sort: null }))?.kind, "invalid");
  assert.equal(
    updateViolation(all, write({ condition: { type: "and", children: [{ type: "hasError" }] } }))
      ?.kind,
    "forbidden",
  );
});

const contract = defineContract({ works: [{ key: "a", tags: ["cv/x"] }] });

async function current(harness: ContractHarness, id: string): Promise<SmartFolder> {
  const { body } = await harness.json<SmartFolder[]>("/api/smart-folders");
  return body.find((item) => item.id === id)!;
}

async function put(harness: ContractHarness, id: string, patch: Partial<SmartFolderWrite>) {
  const now = await current(harness, id);
  return harness.send("PUT", `/api/smart-folders/${id}`, {
    name: now.name,
    condition: now.condition,
    sort: now.sort ?? "added-desc",
    groupBy: now.groupBy,
    groupSort: now.groupSort,
    ...patch,
  });
}

contract("サーバーの検証は shared の権限と同じ結果になる", async (harness) => {
  const created = await harness.send<SmartFolder>("POST", "/api/smart-folders", {
    name: "自作",
    condition: EMPTY,
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
  });
  for (const id of ["all", "fav", "by-cv", created.body.id]) {
    const permissions = smartFolderPermissions(await current(harness, id));
    const status = (ok: boolean, rejected: number) => (ok ? 200 : rejected);
    assert.equal((await put(harness, id, {})).status, 200, `${id}: 同じ定義`);
    assert.equal(
      (await put(harness, id, { name: "改名" })).status,
      status(permissions.rename, 403),
      `${id}: 名前`,
    );
    assert.equal(
      (await put(harness, id, { condition: { type: "and", children: [{ type: "hasError" }] } }))
        .status,
      status(permissions.editCondition, 403),
      `${id}: 条件`,
    );
    assert.equal(
      (await put(harness, id, { groupBy: { kind: "tag" }, groupSort: "count-desc" })).status,
      status(permissions.editGroupBy, 403),
      `${id}: グループ分け`,
    );
    assert.equal(
      (await put(harness, id, { sort: null })).status,
      status(permissions.inheritSort, 400),
      `${id}: 並びの継承`,
    );
  }
  for (const id of ["all", "fav", "by-cv", created.body.id]) {
    const permissions = smartFolderPermissions(await current(harness, id));
    const res = await harness.send("DELETE", `/api/smart-folders/${id}`);
    assert.equal(res.status, permissions.remove ? 204 : 403, `${id}: 削除`);
  }
});

contract("条件の検証エラーはスキーマの文言を返す", async (harness) => {
  const body = (condition: unknown) => ({
    name: "x",
    condition,
    sort: "added-desc",
    groupBy: null,
  });
  const empty = await harness.send(
    "POST",
    "/api/smart-folders",
    body({ type: "or", children: [] }),
  );
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.message, "条件のルートは and にしてください");
  const nested = await harness.send(
    "POST",
    "/api/smart-folders",
    body({ type: "and", children: [{ type: "or", children: [] }] }),
  );
  assert.equal(nested.body.error.message, "子の無い or は保存できません");
  const put = await harness.send(
    "PUT",
    "/api/smart-folders/fav",
    body({ type: "and", children: [{ type: "or", children: [] }] }),
  );
  assert.equal(put.body.error.message, "子の無い or は保存できません");
  const shape = await harness.send("POST", "/api/smart-folders", body({ type: "nope" }));
  assert.equal(shape.status, 400);
  assert.equal(shape.body.error.message, "スマートフォルダーの作成内容が不正です");
});
