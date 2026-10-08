// POST /api/smart-folders/preview（保存前ルールのライブ件数プレビュー）を fixture / real の両方で検証。
// ルールの評価結果が件数として返ることと、リクエスト検証の400を確認する。
import assert from "node:assert/strict";
import type { ApiError, SmartFolderRule } from "@mimimilli/shared";
import { defineContract } from "./helpers/contractHarness.ts";
import { nts } from "./helpers/tag.ts";

const contract = defineContract(
  {
    works: [
      { key: "a", tags: ["ASMR", "cv/x"] },
      { key: "b", tags: ["ASMR"] },
      { key: "c", tags: ["耳かき"] },
    ],
  },
  { shared: true },
);

const tagRule = (conjunction: SmartFolderRule["conjunction"], tag: string): SmartFolderRule => ({
  conjunction,
  field: "タグ",
  operator: "∋",
  values: nts([tag]),
});

contract("ルールに一致する作品数をtotalとして返す", async (harness) => {
  const asmr = await harness.send("POST", "/api/smart-folders/preview", {
    rules: [tagRule("WHERE", "ASMR")],
  });
  assert.equal(asmr.status, 200);
  assert.deepEqual(asmr.body, { total: 2 });

  const both = await harness.send("POST", "/api/smart-folders/preview", {
    rules: [tagRule("WHERE", "ASMR"), tagRule("AND", "cv/x")],
  });
  assert.deepEqual(both.body, { total: 1 });

  const either = await harness.send("POST", "/api/smart-folders/preview", {
    rules: [tagRule("WHERE", "cv/x"), tagRule("OR", "耳かき")],
  });
  assert.deepEqual(either.body, { total: 2 });
});

contract("rulesが空配列なら全作品が対象になる", async (harness) => {
  const res = await harness.send("POST", "/api/smart-folders/preview", {
    rules: [],
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { total: 3 });
});

contract("不正なルールは400を返す", async (harness) => {
  const res = await harness.send("POST", "/api/smart-folders/preview", {
    rules: [{ field: "タグ" }],
  });
  assert.equal(res.status, 400);
});

contract("bodyが無ければ400を返す", async (harness) => {
  const res = await harness.request("/api/smart-folders/preview", { method: "POST" });
  assert.equal(res.status, 400);
});

contract("不正なJSONとスキーマ不一致は同じ400でメッセージが異なる", async (harness) => {
  const post = (body: string) =>
    harness.request("/api/smart-folders/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

  const malformed = await post("{rules:");
  assert.equal(malformed.status, 400);
  const malformedError = ((await malformed.json()) as ApiError).error;
  assert.equal(malformedError.code, "invalid_request");
  assert.equal(malformedError.message, "リクエストの JSON が不正です");

  const invalidSchema = await post(JSON.stringify({ rules: [{ field: "タグ" }] }));
  assert.equal(invalidSchema.status, 400);
  const schemaError = ((await invalidSchema.json()) as ApiError).error;
  assert.equal(schemaError.code, "invalid_request");
  assert.equal(schemaError.message, "スマートフォルダーのプレビュー条件が不正です");
});
