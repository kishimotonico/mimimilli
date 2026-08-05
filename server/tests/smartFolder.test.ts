import { test } from "node:test";
import assert from "node:assert/strict";
import {
  emptyDlsiteState,
  smartFolderRuleSchema,
  type SmartFolderRule,
  type WorkSummary,
} from "@mimimilli/shared";
import { evalSmartFolder, evalSmartFolderRules } from "../src/core/smartFolder.ts";
import { nts } from "./helpers/tag.ts";

function work(
  overrides: Partial<Omit<WorkSummary, "tags">> & Pick<WorkSummary, "id"> & { tags?: string[] },
): WorkSummary {
  return {
    title: overrides.id,
    cover: null,
    status: "ok",
    physicalPath: `/lib/${overrides.id}`,
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    ...overrides,
    tags: nts(overrides.tags ?? []),
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
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["ASMR", "環境音"]) },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(result.map((w) => w.id).sort(), ["RJ001", "RJ002", "RJ004"]);
});

test("タグ ∋: prefix の大文字小文字を無視してマッチする（正規化は保存時に行われる）", () => {
  // ルールの values は smartFolderRuleSchema を通した時点で正規化済み（prefix小文字化）に
  // なる。CV/x を書いても保存後は cv/x として保持され、そのまま work.tags と一致する。
  const rules: SmartFolderRule[] = [
    smartFolderRuleSchema.parse({
      conjunction: "WHERE",
      field: "タグ",
      operator: "∋",
      values: ["CV/x"],
    }),
  ];
  const result = evalSmartFolderRules(rules, [work({ id: "RJ005", tags: ["cv/x"] })]);
  assert.deepEqual(
    result.map((w) => w.id),
    ["RJ005"],
  );
});

test("長さ ≥: totalDurationSec が閾値以上の作品にマッチする", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(result.map((w) => w.id).sort(), ["RJ001", "RJ003", "RJ004"]);
});

test("AND NOT: values のいずれかを含む作品を除外する", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
    { conjunction: "AND NOT", field: "タグ", operator: "∋", values: nts(["催眠"]) },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(result.map((w) => w.id).sort(), ["RJ001", "RJ004"]);
});

test("複合: 長さ条件とタグ条件をAND適用する", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
    { conjunction: "AND", field: "タグ", operator: "∋", values: nts(["ASMR", "環境音"]) },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(result.map((w) => w.id).sort(), ["RJ001", "RJ004"]);
});

test("OR: 直前までの結果と条件に一致する作品を和集合にする", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["催眠"]) },
    { conjunction: "OR", field: "長さ", operator: "≥", values: ["3600"] },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id),
    ["RJ001", "RJ003", "RJ004"],
  );
});

test("ANDとORをルール順に評価する", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["ASMR"]) },
    { conjunction: "AND", field: "長さ", operator: "≥", values: ["3600"] },
    { conjunction: "OR", field: "タグ", operator: "∋", values: nts(["催眠"]) },
  ];
  const result = evalSmartFolderRules(rules, WORKS);
  assert.deepEqual(
    result.map((w) => w.id),
    ["RJ001", "RJ003"],
  );
});

test("未知の field/operator のルールは契約で拒否する", () => {
  const parsed = smartFolderRuleSchema.safeParse({
    conjunction: "WHERE",
    field: "不明な軸",
    operator: "=",
    values: ["x"],
  });
  assert.equal(parsed.success, false);
});

test("タグ ∋ ルールの values は tagSchema による検証を通り、予約文字 @ 始まりの擬似タグを注入できない", () => {
  const parsed = smartFolderRuleSchema.safeParse({
    conjunction: "WHERE",
    field: "タグ",
    operator: "∋",
    values: ["@year/2024"],
  });
  assert.equal(parsed.success, false);
});

test("タグ ∋ ルールの values は workPatchSchema と同じく正規形（trim・prefix小文字化・重複排除）で保存される（TASK-201）", () => {
  const parsed = smartFolderRuleSchema.parse({
    conjunction: "WHERE",
    field: "タグ",
    operator: "∋",
    values: [" CV/藤田茜 ", "cv/藤田茜", "ASMR"],
  });
  assert.deepEqual(parsed.values, ["cv/藤田茜", "ASMR"]);
});

test("DB に不正ルールが混入しても評価時に黙って無視しない", () => {
  const invalidRules = [
    { conjunction: "WHERE", field: "不明な軸", operator: "=", values: ["x"] },
  ] as unknown as SmartFolderRule[];
  assert.throws(
    () => evalSmartFolderRules(invalidRules, WORKS),
    /未対応のスマートフォルダールール/,
  );
});

test("保存済み sort を評価結果へ適用する", () => {
  const result = evalSmartFolder({ rules: [], sort: "title-desc" }, WORKS, {
    page: 1,
    limit: 100,
  });
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ004", "RJ003", "RJ002", "RJ001"],
  );
  assert.equal(result.total, 4);
});

test("保持中フィルタ: tags はフォルダーのルールに対する追加のAND条件として適用する（TASK-185）", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "長さ", operator: "≥", values: ["3600"] },
  ];
  // ルール一致は RJ001/RJ003/RJ004。さらに ASMR タグの AND を重ねると RJ001 だけになる
  const result = evalSmartFolder({ rules, sort: "added-desc" }, WORKS, {
    page: 1,
    limit: 100,
    tags: ["ASMR"],
    tagOp: "AND",
  });
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ001"],
  );
  assert.equal(result.total, 1);
});

test("保持中フィルタ: @year/... 擬似タグ（組み込み軸）もルールに対する追加のAND条件として適用する", () => {
  const yearWorks: WorkSummary[] = [
    work({ id: "RJ010", tags: ["ASMR"], addedAt: "2024-05-01T00:00:00.000Z" }),
    work({ id: "RJ011", tags: ["ASMR"], addedAt: "2025-05-01T00:00:00.000Z" }),
  ];
  const result = evalSmartFolder({ rules: [], sort: "added-desc" }, yearWorks, {
    page: 1,
    limit: 100,
    tags: ["@year/2025"],
  });
  assert.deepEqual(
    result.items.map((w) => w.id),
    ["RJ011"],
  );
});

test("保持中フィルタが無ければルール適用結果をそのまま返す（回帰確認）", () => {
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["ASMR"]) },
  ];
  const result = evalSmartFolder({ rules, sort: "added-desc" }, WORKS, { page: 1, limit: 100 });
  assert.deepEqual(result.items.map((w) => w.id).sort(), ["RJ001", "RJ002"]);
});

test("stats: ルール適用後（ページング前）の集合から集計する", () => {
  const statsWorks: WorkSummary[] = [
    work({ id: "RJ001", tags: ["ASMR"], totalDurationSec: 1800, trackCount: 3 }),
    work({ id: "RJ002", tags: ["ASMR"], totalDurationSec: 3600, trackCount: 2 }),
    work({ id: "RJ003", tags: ["催眠"], totalDurationSec: 5400, trackCount: 1 }),
  ];
  const rules: SmartFolderRule[] = [
    { conjunction: "WHERE", field: "タグ", operator: "∋", values: nts(["ASMR"]) },
  ];
  const result = evalSmartFolder({ rules, sort: "added-desc" }, statsWorks, {
    page: 1,
    limit: 1,
  });
  assert.equal(result.items.length, 1, "ページングでitemsは絞られている");
  assert.deepEqual(result.stats, { trackCount: 5, durationSec: 5400 });
});
