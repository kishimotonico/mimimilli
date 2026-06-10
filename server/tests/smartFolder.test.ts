import { test } from "node:test";
import assert from "node:assert/strict";
import type { SmartFolderRule, WorkSummary } from "@mimikago/shared";
import { evalSmartFolderRules } from "../src/core/smartFolder.ts";

function work(overrides: Partial<WorkSummary> & Pick<WorkSummary, "id">): WorkSummary {
  return {
    title: overrides.id,
    coverImage: null,
    status: "ok",
    physicalPath: `/lib/${overrides.id}`,
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    ...overrides,
  };
}

const WORKS: WorkSummary[] = [
  work({ id: "RJ001", tags: ["ASMR", "環境音"], totalDurationSec: 7200 }),
  work({ id: "RJ002", tags: ["ASMR"], totalDurationSec: 1800 }),
  work({ id: "RJ003", tags: ["催眠"], totalDurationSec: 7200 }),
  work({ id: "RJ004", tags: ["環境音", "睡眠用"], totalDurationSec: 3600 }),
];

test("タグ ∋: values のいずれかを含む作品にマッチする", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: ["ASMR", "環境音"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id).sort(),
    ["RJ001", "RJ002", "RJ004"]
  );
});

test("長さ ≥: totalDurationSec が閾値以上の作品にマッチする", () => {
  const rules: SmartFolderRule[] = [{ conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] }];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id).sort(),
    ["RJ001", "RJ003", "RJ004"]
  );
});

test("AND NOT: values のいずれかを含む作品を除外する", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
    { conjunction: "AND NOT", field: "タグ", operator: "∋", values: ["催眠"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id).sort(),
    ["RJ001", "RJ004"]
  );
});

test("複合: 長さ条件とタグ条件をAND適用する", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
    { conjunction: "AND", field: "タグ", operator: "∋", values: ["ASMR", "環境音"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id).sort(),
    ["RJ001", "RJ004"]
  );
});

test("未知の field/operator のルールはスキップされる", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "不明な軸", operator: "=", values: ["x"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.equal(result.length, WORKS.length);
});
