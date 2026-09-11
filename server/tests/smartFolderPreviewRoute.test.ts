// POST /api/smart-folders/preview（保存前ルールのライブ件数プレビュー）を検証。
// マッチングロジック自体は evalSmartFolderRules 側（smartFolder.test.ts）で担保済みのため、
// ここではルート層の配線（バリデーション・adapterへの委譲・レスポンス形）だけを確認する。
import { test } from "node:test";
import assert from "node:assert/strict";
import type { SmartFolderRule } from "@mimimilli/shared";
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
