import { describe, expect, it } from "vitest";
import { getTagComboboxOptions } from "../../src/shared/ui/TagCombobox";

describe("getTagComboboxOptions", () => {
  it("returns no options for empty input", () => {
    expect(getTagComboboxOptions("", ["ASMR", "睡眠用"])).toEqual([]);
    expect(getTagComboboxOptions("   ", ["ASMR", "睡眠用"])).toEqual([]);
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

  it("treats excludeTags as case-sensitive for flat tags", () => {
    expect(
      getTagComboboxOptions("ASMR", ["ASMR", "Relax ASMR"], { excludeTags: ["asmr"] }),
    ).toEqual([
      { kind: "suggestion", value: "ASMR" },
      { kind: "suggestion", value: "Relax ASMR" },
    ]);
  });

  it("ignores case in suggestion search for flat tags", () => {
    expect(getTagComboboxOptions("abc", ["ABC"]).filter((o) => o.kind === "suggestion")).toEqual([
      { kind: "suggestion", value: "ABC" },
    ]);
    expect(getTagComboboxOptions("ABC", ["ABC"])).toEqual([{ kind: "suggestion", value: "ABC" }]);
  });

  it("ignores case in suggestion search for prefix/value tags", () => {
    expect(getTagComboboxOptions("circle/ABC", ["Circle/ABC"])).toEqual([
      { kind: "suggestion", value: "Circle/ABC" },
    ]);
    expect(
      getTagComboboxOptions("circle/abc", ["Circle/ABC"]).filter((o) => o.kind === "suggestion"),
    ).toEqual([{ kind: "suggestion", value: "Circle/ABC" }]);
  });

  it("keeps exact-match identity case-sensitive even when search matches loosely", () => {
    // 検索の寛容さ（大文字小文字無視）と同一性の厳密さ（normalizeTag準拠）は独立。
    // "asmr" は既存の "ASMR" を候補として拾いつつ、厳密には別タグ扱いなので
    // create オプションも残る（Enterのデフォルト選択は先頭の候補になる）。
    expect(getTagComboboxOptions("asmr", ["ASMR"])).toEqual([
      { kind: "suggestion", value: "ASMR" },
      { kind: "create", value: "asmr" },
    ]);
  });

  it("returns no options for non-normalizable input", () => {
    expect(getTagComboboxOptions("a/", ["a/b"])).toEqual([]);
  });

  it("shows partial-match suggestions and create option", () => {
    expect(getTagComboboxOptions("睡眠", ["ASMR", "睡眠用"])).toEqual([
      { kind: "suggestion", value: "睡眠用" },
      { kind: "create", value: "睡眠" },
    ]);
  });

  it("does not show create option on exact match", () => {
    expect(getTagComboboxOptions("ASMR", ["ASMR", "Relax ASMR"])).toEqual([
      { kind: "suggestion", value: "ASMR" },
      { kind: "suggestion", value: "Relax ASMR" },
    ]);
  });

  it("does not show create option when canCreate returns false", () => {
    expect(getTagComboboxOptions("new", ["ASMR"], { canCreate: () => false })).toEqual([]);
  });
});
