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

test("splitSelectedTags: 擬似タグとして解釈できない @ 始まりの入力は警告付きで拒否し、実タグへ流さない（TASK-201）", () => {
  // "@year/" は normalizeTag が annotated タグの値が空（"@year" + 空値）とみなし正規化後に
  // 空文字列を返すため、拒否理由は「正規化後に空になるタグ」側になる。いずれの理由でも
  // tags へは積まれず実タグへ素通りしないことが本題。
  for (const badTag of ["@year", "@year/", "@/2024"]) {
    const result = splitSelectedTags([badTag, "cv/藤田茜"]);
    assert.deepEqual(result.tags, ["cv/藤田茜"], badTag);
    assert.equal(result.yearValue, null, badTag);
    assert.equal(result.warnings.length, 1, badTag);
  }
  assert.match(splitSelectedTags(["@year"]).warnings[0]!, /擬似タグとして解釈できない/);
  assert.match(splitSelectedTags(["@/2024"]).warnings[0]!, /擬似タグとして解釈できない/);
});

test("splitSelectedTags: 4桁の数字でない year 値は警告付きで拒否する（TASK-201）", () => {
  for (const badTag of ["@year/banana", "@year/24", "@year/20245"]) {
    const result = splitSelectedTags([badTag]);
    assert.deepEqual(result.tags, [], badTag);
    assert.equal(result.yearValue, null, badTag);
    assert.equal(result.warnings.length, 1, badTag);
  }
});

test("splitSelectedTags: 先頭に空白を挟んだ擬似タグは正規化しても救済せず、警告付きで拒否する（TASK-202）", () => {
  const result = splitSelectedTags([" @year/2024", "cv/藤田茜"]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.equal(result.yearValue, null);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0]!, /予約文字混じりの不正な入力/);
  assert.match(result.warnings[0]!, /@year\/2024/);
});

test("splitSelectedTags: 予約文字を含まない入力は正規化後の値がそのまま実タグとして採用される", () => {
  const result = splitSelectedTags([" CV/藤田茜 "]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.deepEqual(result.warnings, []);
});
