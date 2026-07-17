import { describe, expect, it } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import { sortTagsForDisplay } from "../../src/entities/work/sortTagsForDisplay";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "サークル", label: "サークル", color: null, showAsAxis: true, protected: true },
  { prefix: "シリーズ", label: "シリーズ", color: null, showAsAxis: true, protected: false },
  { prefix: "カテゴリ", label: "カテゴリ", color: null, showAsAxis: true, protected: false },
  { prefix: "genre", label: "ジャンル", color: null, showAsAxis: false, protected: false },
];

describe("sortTagsForDisplay", () => {
  it("prefix 定義順、未登録 prefix、フラットタグの順に並べる", () => {
    const tags = [
      "ASMR",
      "genre/癒し",
      "maker/夜想曲",
      "cv/茅野愛衣",
      "サークル/鈴の音",
      "睡眠用",
      "カテゴリ/ボイス・ASMR",
      "unknown/立体音響",
      "シリーズ/月夜",
    ];

    expect(sortTagsForDisplay(tags, PREFIXES)).toEqual([
      "cv/茅野愛衣",
      "サークル/鈴の音",
      "シリーズ/月夜",
      "カテゴリ/ボイス・ASMR",
      "genre/癒し",
      "maker/夜想曲",
      "unknown/立体音響",
      "ASMR",
      "睡眠用",
    ]);
  });

  it("各 prefix グループ内の相対順を保つ", () => {
    const tags = ["cv/一人目", "ASMR", "cv/二人目", "maker/A", "maker/B", "睡眠用"];

    expect(sortTagsForDisplay(tags, PREFIXES)).toEqual([
      "cv/一人目",
      "cv/二人目",
      "maker/A",
      "maker/B",
      "ASMR",
      "睡眠用",
    ]);
  });

  it("入力配列を変更しない", () => {
    const tags = ["ASMR", "cv/茅野愛衣"];

    expect(sortTagsForDisplay(tags, PREFIXES)).toEqual(["cv/茅野愛衣", "ASMR"]);
    expect(tags).toEqual(["ASMR", "cv/茅野愛衣"]);
  });
});
