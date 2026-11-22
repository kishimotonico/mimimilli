import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBuiltinPseudoTag,
  normalizeTag,
  parseBuiltinPseudoTag,
  splitSelectedTags,
  type NormalizedTag,
} from "@mimimilli/shared";

/** テスト内で生文字列から NormalizedTag を作る。正規化できない入力を渡すテストの前提が
 *  崩れていないことも同時に確認する。 */
function nt(tag: string): NormalizedTag {
  const normalized = normalizeTag(tag);
  assert.notEqual(normalized, null, `テスト前提: "${tag}" は正規化できるはず`);
  return normalized!;
}

test("buildBuiltinPseudoTag / parseBuiltinPseudoTag: 組み立てた擬似タグを分解するとキーと値が復元できる", () => {
  const tag = buildBuiltinPseudoTag("year", "2024");
  assert.equal(tag, "@year/2024");
  assert.deepEqual(parseBuiltinPseudoTag(tag), { key: "year", value: "2024" });
});

test("parseBuiltinPseudoTag: 予約文字 @ で始まらない文字列は擬似タグとして解釈しない", () => {
  assert.equal(parseBuiltinPseudoTag(nt("year/2025")), null);
  assert.equal(parseBuiltinPseudoTag(nt("cv/藤田茜")), null);
});

test("parseBuiltinPseudoTag: キーや値が欠けた不正な形は null", () => {
  // "@year/"（値が空）は normalizeTag 自体が null を返すため、NormalizedTag として
  // 構築できず parseBuiltinPseudoTag に到達し得ない（型がその不変条件を保証する）。
  assert.equal(normalizeTag("@year/"), null);
  assert.equal(parseBuiltinPseudoTag(nt("@year")), null);
  assert.equal(parseBuiltinPseudoTag(nt("@/2024")), null);
});

test("parseBuiltinPseudoTag: 判定は正規化後の値に対して行われ、先頭に空白を挟んだ入力も擬似タグとして認識する", () => {
  assert.deepEqual(parseBuiltinPseudoTag(nt(" @year/2024")), { key: "year", value: "2024" });
  assert.deepEqual(parseBuiltinPseudoTag(nt("  @Year/2024")), { key: "year", value: "2024" });
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

test("splitSelectedTags: 未知の擬似タグは警告付きで拒否し、実タグとしても解釈しない", () => {
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

test("splitSelectedTags: 擬似タグとして解釈できない @ 始まりの入力は警告付きで拒否し、実タグへ流さない", () => {
  // "@year/" は normalizeTag が annotated タグの値が空（"@year" + 空値）とみなし正規化後に
  // null を返すため、拒否理由は「正規化後に空になるタグ」側になる。いずれの理由でも
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

test("splitSelectedTags: 4桁の数字でない year 値は警告付きで拒否する", () => {
  for (const badTag of ["@year/banana", "@year/24", "@year/20245"]) {
    const result = splitSelectedTags([badTag]);
    assert.deepEqual(result.tags, [], badTag);
    assert.equal(result.yearValue, null, badTag);
    assert.equal(result.warnings.length, 1, badTag);
  }
});

test("splitSelectedTags: 先頭に空白を挟んだ擬似タグも正規化後の値で判定され、無警告でyearValueへ採用される", () => {
  const result = splitSelectedTags([" @year/2024", "cv/藤田茜"]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.equal(result.yearValue, "2024");
  assert.deepEqual(result.warnings, []);
});

test("splitSelectedTags: 予約文字を含まない入力は正規化後の値がそのまま実タグとして採用される", () => {
  const result = splitSelectedTags([" CV/藤田茜 "]);
  assert.deepEqual(result.tags, ["cv/藤田茜"]);
  assert.deepEqual(result.warnings, []);
});
