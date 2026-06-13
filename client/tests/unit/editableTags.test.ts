import { describe, expect, it } from "vitest";
import {
  buildWorkPatchTags,
  getEditableFlatTags,
} from "../../src/entities/work/editableTags";

describe("editable work tags", () => {
  it("keeps prefixed tags and replaces only flat tags", () => {
    expect(
      buildWorkPatchTags(
        ["ASMR", "cv/水瀬なずな", "サークル/月白製作所", "癒し系"],
        ["睡眠用", "ASMR"]
      )
    ).toEqual([
      "cv/水瀬なずな",
      "サークル/月白製作所",
      "睡眠用",
      "ASMR",
    ]);
  });

  it("uses parseTag boundaries for prefixed and flat values", () => {
    expect(
      buildWorkPatchTags(
        ["シリーズ/雨夜", "カテゴリ/ASMR", "custom/value", "/先頭スラッシュ"],
        ["/先頭スラッシュ", "新規", "cv/編集対象外"]
      )
    ).toEqual([
      "シリーズ/雨夜",
      "カテゴリ/ASMR",
      "custom/value",
      "/先頭スラッシュ",
      "新規",
    ]);
  });

  it("trims flat tags and removes structured and flat duplicates", () => {
    expect(
      buildWorkPatchTags(
        ["cv/水瀬なずな", "cv/水瀬なずな", "ASMR"],
        [" ASMR ", "ASMR", "", "   "]
      )
    ).toEqual(["cv/水瀬なずな", "ASMR"]);
  });

  it("returns only flat tags for the editable draft", () => {
    expect(
      getEditableFlatTags(["cv/水瀬なずな", "ASMR", "カテゴリ/音声作品", "癒し系", "ASMR"])
    ).toEqual(["ASMR", "癒し系"]);
  });
});
