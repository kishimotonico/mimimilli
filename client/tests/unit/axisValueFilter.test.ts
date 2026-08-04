import { describe, expect, it } from "vitest";
import type { AxisFacetItem } from "@mimimilli/shared";
import { filterAxisValueItems } from "../../src/features/library/model/axisValueFilter";

function item(value: string): AxisFacetItem {
  return { value, count: 1, durationSec: 0, covers: [] };
}

describe("filterAxisValueItems（値一覧のコンテキスト検索）", () => {
  it("空クエリはそのまま全件を返す", () => {
    const items = [item("藤田茜"), item("夜想曲")];
    expect(filterAxisValueItems(items, "")).toBe(items);
  });

  it("部分一致・大文字小文字を無視して絞り込む", () => {
    const items = [item("Alpha"), item("beta"), item("Gamma")];
    expect(filterAxisValueItems(items, "a").map((i) => i.value)).toEqual([
      "Alpha",
      "beta",
      "Gamma",
    ]);
    expect(filterAxisValueItems(items, "BET").map((i) => i.value)).toEqual(["beta"]);
  });

  it("前後の空白は無視する", () => {
    const items = [item("cv/藤田茜")];
    expect(filterAxisValueItems(items, "  藤田  ").map((i) => i.value)).toEqual(["cv/藤田茜"]);
  });

  it("一致しない場合は空配列を返す", () => {
    const items = [item("Alpha")];
    expect(filterAxisValueItems(items, "存在しない")).toEqual([]);
  });
});
