import type { TagPrefix } from "@mimimilli/shared";
import {
  formatSmartFolderDuration,
  formatSmartFolderLengthValue,
  formatSmartFolderOperatorLabel,
  resolveSmartFolderTagChip,
} from "../../src/features/library/model/smartFolderFormat";

describe("smartFolderFormat", () => {
  test.each([
    [{ field: "タグ" as const, operator: "∋", values: ["ASMR"] }, "を含む"],
    [{ field: "長さ" as const, operator: "≥", values: ["3600"] }, ""],
  ])("formatSmartFolderOperatorLabel(%o) === %s", (rule, expected) => {
    expect(formatSmartFolderOperatorLabel(rule)).toBe(expected);
  });

  test.each([
    [0, "0分"],
    [59, "0分"],
    [60, "1分"],
    [3600, "1時間"],
    [3600 + 30 * 60, "1時間30分"],
    [99 * 3600 + 30 * 60, "99時間30分"],
  ])("formatSmartFolderDuration(%i) === %s", (seconds, expected) => {
    expect(formatSmartFolderDuration(seconds)).toBe(expected);
  });

  test("formatSmartFolderLengthValue は演算子込みの自然文を返す", () => {
    const rule = { field: "長さ" as const, operator: "≥", values: [String(99 * 3600 + 30 * 60)] };
    expect(formatSmartFolderLengthValue(rule)).toBe("99時間30分以上");
  });

  describe("resolveSmartFolderTagChip", () => {
    const tagPrefixes: TagPrefix[] = [
      {
        prefix: "cv",
        label: "CV",
        color: "cv",
        showAsAxis: true,
        protected: true,
        order: 0,
      },
    ];
    const tagSuggestions = ["cv/花子", "ASMR"];

    test("登録済みprefixのラベル・色を解決する", () => {
      expect(resolveSmartFolderTagChip("cv/花子", tagPrefixes, tagSuggestions)).toEqual({
        prefixLabel: "CV",
        color: "cv",
        displayValue: "花子",
        isUnknown: false,
      });
    });

    test("未登録prefixはprefix文字列そのままをラベルにする", () => {
      expect(
        resolveSmartFolderTagChip("series/未登録シリーズ", tagPrefixes, tagSuggestions),
      ).toEqual({
        prefixLabel: "series",
        color: null,
        displayValue: "未登録シリーズ",
        isUnknown: true,
      });
    });

    test("フラットタグはprefixLabelがnull", () => {
      expect(resolveSmartFolderTagChip("ASMR", tagPrefixes, tagSuggestions)).toEqual({
        prefixLabel: null,
        color: null,
        displayValue: "ASMR",
        isUnknown: false,
      });
    });

    test("tagSuggestionsに無いタグはisUnknown=true", () => {
      expect(resolveSmartFolderTagChip("cv/現存しない", tagPrefixes, tagSuggestions)).toEqual({
        prefixLabel: "CV",
        color: "cv",
        displayValue: "現存しない",
        isUnknown: true,
      });
    });
  });
});
