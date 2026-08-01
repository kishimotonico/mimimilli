import { describe, expect, it } from "vitest";
import type { AxisFacetItem, TagPrefix } from "@mimimilli/shared";
import { groupTagFacetItems } from "../../src/features/library/model/tagAxisGrouping";

const tagPrefixes: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true },
  {
    prefix: "サークル",
    label: "サークル",
    color: "circle",
    showAsAxis: true,
    protected: true,
  },
];

describe("groupTagFacetItems", () => {
  it("フラットタグ・登録済みprefix・未登録prefixの順にグループ化する", () => {
    const facetItems: AxisFacetItem[] = [
      { value: "ASMR", count: 5 },
      { value: "cv/藤田茜", count: 4 },
      { value: "気分/睡眠用", count: 3 },
      { value: "サークル/夜想曲", count: 2 },
      { value: "添い寝", count: 1 },
    ];

    const groups = groupTagFacetItems(facetItems, tagPrefixes);

    expect(groups.map((g) => g.key)).toEqual(["", "cv", "サークル", "気分"]);
    expect(groups[0]!.label).toBe("タグ");
    expect(groups[0]!.items).toEqual([
      { value: "ASMR", count: 5 },
      { value: "添い寝", count: 1 },
    ]);
    expect(groups[1]).toEqual({
      key: "cv",
      label: "CV",
      color: "cv",
      items: [{ value: "cv/藤田茜", count: 4 }],
    });
    expect(groups[3]).toEqual({
      key: "気分",
      label: "気分",
      color: null,
      items: [{ value: "気分/睡眠用", count: 3 }],
    });
  });

  it("空タグ配列では空グループ配列を返す", () => {
    expect(groupTagFacetItems([], tagPrefixes)).toEqual([]);
  });

  it("該当タグが無い prefix 定義はグループを作らない", () => {
    const facetItems: AxisFacetItem[] = [{ value: "cv/藤田茜", count: 1 }];
    const groups = groupTagFacetItems(facetItems, tagPrefixes);
    expect(groups.map((g) => g.key)).toEqual(["cv"]);
  });
});
