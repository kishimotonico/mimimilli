// スマートフォルダーの不変条件（ADR-0040）。shared の検証関数を縛る。
import assert from "node:assert/strict";
import { test } from "node:test";
import { smartFolderViolation } from "@mimimilli/shared";
import { defineContract } from "./helpers/contractHarness.ts";

const EMPTY = { type: "and" as const, children: [] };
test("行の検証: グループ分けと値の並びは、どちらも持つか、どちらも持たない", () => {
  const row = {
    id: "sf-x",
    name: "x",
    condition: EMPTY,
    sort: null,
    groupBy: null,
    groupSort: null,
  };
  assert.equal(smartFolderViolation(row), null);
  const grouped = { groupBy: { kind: "tag" } as const, groupSort: "count-desc" as const };
  assert.equal(smartFolderViolation({ ...row, ...grouped }), null);
  assert.ok(smartFolderViolation({ ...row, groupBy: grouped.groupBy }));
  assert.ok(smartFolderViolation({ ...row, groupSort: grouped.groupSort }));
});

test("行の検証: 保存できない条件の形を弾く", () => {
  const row = { id: "sf-x", name: "x", sort: null, groupBy: null, groupSort: null };
  const nested = {
    type: "and" as const,
    children: [{ type: "or" as const, children: [{ type: "or" as const, children: [] }] }],
  };
  assert.ok(smartFolderViolation({ ...row, condition: nested }));
  assert.ok(smartFolderViolation({ ...row, condition: { type: "bookmarked" } }));
});

test("行の検証: 「すべて」の形は、名前・空の条件・グループ分けなし・並びあり", () => {
  const all = {
    id: "all",
    name: "すべて",
    condition: EMPTY,
    sort: "added-desc" as const,
    groupBy: null,
    groupSort: null,
  };
  assert.equal(smartFolderViolation(all), null);
  assert.ok(smartFolderViolation({ ...all, name: "全部" }));
  assert.ok(smartFolderViolation({ ...all, sort: null }));
  assert.ok(
    smartFolderViolation({ ...all, condition: { type: "and", children: [{ type: "hasError" }] } }),
  );
  assert.ok(smartFolderViolation({ ...all, groupBy: { kind: "tag" }, groupSort: "count-desc" }));
});

const contract = defineContract({ works: [{ key: "a", tags: ["cv/x"] }] });

contract("条件の検証エラーはスキーマの文言を返す", async (harness) => {
  const body = (condition: unknown) => ({
    name: "x",
    condition,
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
  });
  const empty = await harness.send(
    "POST",
    "/api/smart-folders",
    body({ type: "or", children: [] }),
  );
  assert.equal(empty.status, 400);
  assert.equal(empty.body.error.message, "条件のルートは and にしてください");
  const nested = {
    type: "and",
    children: [{ type: "or", children: [] }],
  };
  const created = await harness.send("POST", "/api/smart-folders", body(nested));
  assert.equal(created.body.error.message, "子の無い or は保存できません");
  const patched = await harness.send("PATCH", "/api/smart-folders/fav", { condition: nested });
  assert.equal(patched.body.error.message, "子の無い or は保存できません");
  const shape = await harness.send("POST", "/api/smart-folders", body({ type: "nope" }));
  assert.equal(shape.status, 400);
  assert.equal(shape.body.error.message, "作成内容が不正です");
});

contract("行の不変条件の違反は、違反の説明を400で返す", async (harness) => {
  const res = await harness.send("PATCH", "/api/smart-folders/all", { sort: null });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.message, "「すべて」の既定の並びは空にできません");
  const pair = await harness.send("PATCH", "/api/smart-folders/fav", { groupSort: "count-desc" });
  assert.equal(pair.body.error.message, "値の並びはグループ分けがあるときだけ指定します");
});
