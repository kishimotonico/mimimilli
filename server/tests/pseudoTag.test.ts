import assert from "node:assert/strict";
import { test } from "node:test";
import { buildBuiltinAxisTag, parseBuiltinAxisTag, splitSelectedTags } from "@mimimilli/shared";

test("buildBuiltinAxisTag / parseBuiltinAxisTag: 組み立てた擬似タグを分解すると軸と値が復元できる", () => {
  const tag = buildBuiltinAxisTag("year", "2024");
  assert.equal(tag, "@year/2024");
  assert.deepEqual(parseBuiltinAxisTag(tag), { axis: "year", value: "2024" });
});

test("parseBuiltinAxisTag: 予約文字 @ で始まらない文字列は擬似タグとして解釈しない", () => {
  assert.equal(parseBuiltinAxisTag("year/2025"), null);
  assert.equal(parseBuiltinAxisTag("cv/藤田茜"), null);
});

test("parseBuiltinAxisTag: 軸や値が欠けた不正な形は null", () => {
  assert.equal(parseBuiltinAxisTag("@year"), null);
  assert.equal(parseBuiltinAxisTag("@year/"), null);
  assert.equal(parseBuiltinAxisTag("@/2024"), null);
});

test("splitSelectedTags: year 擬似タグを yearValue へ、それ以外は tags へ振り分ける", () => {
  const result = splitSelectedTags(["cv/藤田茜", "@year/2024", "サークル/月白製作所"]);
  assert.deepEqual(result.tags, ["cv/藤田茜", "サークル/月白製作所"]);
  assert.equal(result.yearValue, "2024");
  assert.deepEqual(result.warnings, []);
});

test("splitSelectedTags: year 擬似タグが無ければ yearValue は null", () => {
  const result = splitSelectedTags(["ASMR"]);
  assert.deepEqual(result.tags, ["ASMR"]);
  assert.equal(result.yearValue, null);
  assert.deepEqual(result.warnings, []);
});

test("splitSelectedTags: 実タグ year/2025（予約文字 @ が無い）は addedAt の年照合ではなくタグ完全一致になる", () => {
  const result = splitSelectedTags(["year/2025"]);
  assert.deepEqual(result.tags, ["year/2025"]);
  assert.equal(result.yearValue, null);
});

test("splitSelectedTags: 複数の year 擬似タグは先頭だけを採用し、残りは警告付きで拒否する", () => {
  const result = splitSelectedTags(["@year/2023", "@year/2024"]);
  assert.deepEqual(result.tags, []);
  assert.equal(result.yearValue, "2023");
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /@year\/2024/);
});

test("splitSelectedTags: 未知の組み込み軸の擬似タグは警告付きで拒否し、実タグとしても解釈しない", () => {
  const result = splitSelectedTags(["@unknown/2024", "cv/藤田茜"]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.equal(result.yearValue, null);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /@unknown\/2024/);
});

test("splitSelectedTags: 正規化後に空になるタグは警告付きで拒否する", () => {
  const result = splitSelectedTags(["  ", "cv/藤田茜"]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.equal(result.warnings.length, 1);
});
