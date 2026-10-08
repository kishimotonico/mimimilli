// POST /api/smart-folders/preview（保存前ルールのライブ件数プレビュー）を検証。
// マッチングロジック自体は evalSmartFolderRules 側（smartFolder.test.ts）で担保済みのため、
// ここではルート層の配線（バリデーション・adapterへの委譲・レスポンス形）だけを確認する。
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ApiError, SmartFolderRule } from "@mimimilli/shared";
import { createApp } from "../src/app.ts";
import { createFixtureAdapter } from "../src/adapters/fixture/index.ts";
import { nts } from "./helpers/tag.ts";

function buildApp(previewSmartFolderRuleCount: (rules: SmartFolderRule[]) => Promise<number>) {
  return createApp({ ...createFixtureAdapter(), previewSmartFolderRuleCount });
}

test("ルールをadapterへそのまま渡し、件数をtotalとして返す", async () => {
  let received: SmartFolderRule[] | null = null;
  const app = buildApp(async (rules) => {
    received = rules;
    return 3;
  });
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["ASMR"]) },
  ];
  const res = await app.request("/api/smart-folders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { total: 3 });
  assert.deepEqual(received, rules);
});

test("rulesが空配列でも受け付ける", async () => {
  const app = buildApp(async (rules) => rules.length);
  const res = await app.request("/api/smart-folders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [] }),
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { total: 0 });
});

test("不正なルールは400を返す", async () => {
  const app = buildApp(async () => 0);
  const res = await app.request("/api/smart-folders/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rules: [{ field: "タグ" }] }),
  });
  assert.equal(res.status, 400);
});

test("bodyが無ければ400を返す", async () => {
  const app = buildApp(async () => 0);
  const res = await app.request("/api/smart-folders/preview", { method: "POST" });
  assert.equal(res.status, 400);
});

test("不正なJSONとスキーマ不一致は同じ400でメッセージが異なる", async () => {
  const app = buildApp(async () => 0);
  const post = (body: string) =>
    app.request("/api/smart-folders/preview", {
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
