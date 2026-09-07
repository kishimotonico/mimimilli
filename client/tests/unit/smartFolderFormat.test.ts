import {
  formatSmartFolderDuration,
  formatSmartFolderLengthValue,
  formatSmartFolderOperatorLabel,
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
});
