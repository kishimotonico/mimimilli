import { describe, expect, it } from "vitest";
import { getTagComboboxOptions } from "../../src/shared/ui/TagCombobox";

describe("getTagComboboxOptions", () => {
  it("returns no options for empty input", () => {
    expect(getTagComboboxOptions("", ["ASMR", "睡眠用"])).toEqual([]);
    expect(getTagComboboxOptions("   ", ["ASMR", "睡眠用"])).toEqual([]);
  });

  it("filters suggestions by case-insensitive partial match", () => {
    expect(
      getTagComboboxOptions("as", ["ASMR", "睡眠用", "Relax ASMR", "環境音"])
    ).toEqual([
      { kind: "suggestion", value: "ASMR" },
      { kind: "suggestion", value: "Relax ASMR" },
      { kind: "create", value: "as" },
    ]);
  });

  it("limits matching suggestions to the first 8", () => {
    const suggestions = Array.from({ length: 10 }, (_, index) => `tag-${index + 1}`);

    expect(getTagComboboxOptions("tag", suggestions)).toEqual([
      { kind: "suggestion", value: "tag-1" },
      { kind: "suggestion", value: "tag-2" },
      { kind: "suggestion", value: "tag-3" },
      { kind: "suggestion", value: "tag-4" },
      { kind: "suggestion", value: "tag-5" },
      { kind: "suggestion", value: "tag-6" },
      { kind: "suggestion", value: "tag-7" },
      { kind: "suggestion", value: "tag-8" },
      { kind: "create", value: "tag" },
    ]);
  });

  it("does not show a create option when an exact match exists", () => {
    expect(getTagComboboxOptions("asmr", ["睡眠用", "ASMR"])).toEqual([
      { kind: "suggestion", value: "ASMR" },
    ]);
  });

  it("checks exact matches outside the visible top 8", () => {
    const suggestions = [
      "tag-1",
      "tag-2",
      "tag-3",
      "tag-4",
      "tag-5",
      "tag-6",
      "tag-7",
      "tag-8",
      "tag",
    ];

    expect(getTagComboboxOptions("tag", suggestions)).toEqual([
      { kind: "suggestion", value: "tag-1" },
      { kind: "suggestion", value: "tag-2" },
      { kind: "suggestion", value: "tag-3" },
      { kind: "suggestion", value: "tag-4" },
      { kind: "suggestion", value: "tag-5" },
      { kind: "suggestion", value: "tag-6" },
      { kind: "suggestion", value: "tag-7" },
      { kind: "suggestion", value: "tag-8" },
    ]);
  });

  it("does not show excluded tags or create an excluded exact tag", () => {
    expect(
      getTagComboboxOptions("ASMR", ["ASMR", "Relax ASMR"], { excludeTags: ["asmr"] })
    ).toEqual([
      { kind: "suggestion", value: "Relax ASMR" },
    ]);
  });
});
