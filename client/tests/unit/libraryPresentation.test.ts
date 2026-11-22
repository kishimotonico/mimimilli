import { describe, expect, it, vi } from "vitest";
import type { AxisFacetItem } from "@mimimilli/shared";
import { ApiRequestError } from "../../src/shared/api/http";
import { nt } from "../helpers/tag";
import {
  axisOfGroupBy,
  buildFilterTag,
  buildWorksResetKey,
  computeCollectionStatsDisplay,
  computeIsNoResultsDueToFilter,
  filterValidFacetItems,
  formatFilterChipLabel,
  groupByOfAxis,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "../../src/features/library/model/libraryPresentation";

function facetItem(value: string): AxisFacetItem {
  return { value, count: 1, durationSec: 0, covers: [] };
}

describe("buildFilterTag", () => {
  it("tag 軸はそのまま返す（値が既に完全なタグ文字列のため）", () => {
    expect(buildFilterTag("tag", "cv/藤田茜")).toBe("cv/藤田茜");
  });
  it("実タグ由来の facet 軸は 軸/値 の実タグを組み立てる", () => {
    expect(buildFilterTag("cv", "藤田茜")).toBe("cv/藤田茜");
  });
  it("year（タグ由来でない組み込み軸）は @軸/値 の擬似タグを組み立てる", () => {
    expect(buildFilterTag("year", "2024")).toBe("@year/2024");
  });
});

describe("filterValidFacetItems", () => {
  it("正規化できない値をスキップしconsole.warnする", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = filterValidFacetItems("tag", [facetItem("cv/藤田茜"), facetItem("   ")]);

    expect(result).toEqual([facetItem("cv/藤田茜")]);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("すべて正規化できる値ならそのまま返す", () => {
    const items = [facetItem("cv/藤田茜"), facetItem("cv/霧島レイ")];

    expect(filterValidFacetItems("cv", items)).toEqual(items);
  });
});

describe("computeIsNoResultsDueToFilter", () => {
  it("is false when the axis is just naturally empty (no search/filter)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "", [], false, false)).toBe(false);
  });
  it("is true when a search query narrows to zero results (query settled: not loading/error)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", [], false, false)).toBe(true);
  });
  it("is true when a selected tag filter narrows to zero results", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "", ["存在しないタグ"], false, false)).toBe(true);
  });
  it("is false while the debounced query is still loading, even though works is temporarily empty", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", [], true, false)).toBe(false);
  });
  it("is false when the works query errored (0件が確定した結果ではないため)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", [], false, true)).toBe(false);
  });
  it("is false when the pane isn't a works pane", () => {
    expect(computeIsNoResultsDueToFilter(false, 0, "存在しない語", [], false, false)).toBe(false);
  });
});

describe("shouldClearSelectionOnFilterMiss", () => {
  it("絞り込みで0件かつ選択中の作品があれば解除すべき", () => {
    expect(shouldClearSelectionOnFilterMiss(true, "w1")).toBe(true);
  });
  it("絞り込みで0件でも選択が無ければ何もしない", () => {
    expect(shouldClearSelectionOnFilterMiss(true, null)).toBe(false);
  });
  it("絞り込みが原因の0件でなければ選択を維持する", () => {
    expect(shouldClearSelectionOnFilterMiss(false, "w1")).toBe(false);
  });
});

describe("shouldClearSelectionOnWorkNotFound", () => {
  it("404エラーなら選択解除すべき", () => {
    expect(
      shouldClearSelectionOnWorkNotFound("w1", new ApiRequestError(404, "not_found", "not found")),
    ).toBe(true);
  });
  it("404以外のエラー（5xx等）では選択を維持する", () => {
    expect(
      shouldClearSelectionOnWorkNotFound(
        "w1",
        new ApiRequestError(500, "internal_error", "server error"),
      ),
    ).toBe(false);
  });
  it("ApiRequestErrorでない一般的なエラー（ネットワーク断等）では選択を維持する", () => {
    expect(shouldClearSelectionOnWorkNotFound("w1", new Error("network error"))).toBe(false);
  });
  it("エラーが無ければ何もしない", () => {
    expect(shouldClearSelectionOnWorkNotFound("w1", null)).toBe(false);
  });
  it("選択自体が無ければ何もしない", () => {
    expect(
      shouldClearSelectionOnWorkNotFound(null, new ApiRequestError(404, "not_found", "not found")),
    ).toBe(false);
  });
});

describe("computeCollectionStatsDisplay", () => {
  it("isError なら loading/未取得より優先して error を返す", () => {
    expect(
      computeCollectionStatsDisplay(true, true, 10, { trackCount: 5, durationSec: 100 }),
    ).toEqual({
      status: "error",
    });
  });

  it("isLoading 中は loading を返す", () => {
    expect(computeCollectionStatsDisplay(true, false, undefined, undefined)).toEqual({
      status: "loading",
    });
  });

  it("total/stats が未到着（undefined）でも loading 扱いにする（雑にフォールバックしない）", () => {
    expect(
      computeCollectionStatsDisplay(false, false, undefined, { trackCount: 0, durationSec: 0 }),
    ).toEqual({
      status: "loading",
    });
    expect(computeCollectionStatsDisplay(false, false, 0, undefined)).toEqual({
      status: "loading",
    });
  });

  it("すべて揃っていれば ready で件数・トラック数・再生時間を渡す", () => {
    expect(
      computeCollectionStatsDisplay(false, false, 11, { trackCount: 87, durationSec: 45296 }),
    ).toEqual({ status: "ready", count: 11, trackCount: 87, durationSec: 45296 });
  });
});

describe("formatFilterChipLabel（チップの内部表現を隠す）", () => {
  it("組み込み軸の擬似タグは「軸ラベル/値」に変換する", () => {
    expect(formatFilterChipLabel(nt("@year/2024"))).toBe("追加日/2024");
  });

  it("実タグはフルパスのまま変更しない", () => {
    expect(formatFilterChipLabel(nt("cv/藤田茜"))).toBe("cv/藤田茜");
    expect(formatFilterChipLabel(nt("ASMR"))).toBe("ASMR");
  });
});

describe("axisOfGroupBy / groupByOfAxis（グループ分けと軸 ID の対応）", () => {
  it("prefix・タグ・追加年を軸 ID に写す", () => {
    expect(axisOfGroupBy({ kind: "prefix", prefix: "cv" })).toBe("cv");
    expect(axisOfGroupBy({ kind: "tag" })).toBe("tag");
    expect(axisOfGroupBy({ kind: "addedYear" })).toBe("year");
  });

  it("軸 ID からグループ分けへ戻せる（「＋絞り込み」の候補用）", () => {
    expect(groupByOfAxis("cv")).toEqual({ kind: "prefix", prefix: "cv" });
    expect(groupByOfAxis("tag")).toEqual({ kind: "tag" });
    expect(groupByOfAxis("year")).toEqual({ kind: "addedYear" });
  });
});

describe("buildWorksResetKey", () => {
  const base = {
    folderId: "all",
    group: null,
    selectedTags: [nt("ASMR")],
    sort: "added-desc",
    searchQuery: "",
    seed: undefined,
  };

  it("同じ入力なら同じキー", () => {
    expect(buildWorksResetKey(base)).toBe(buildWorksResetKey({ ...base }));
  });

  it.each([
    ["フォルダー", { folderId: "fav" }],
    ["グループの値", { group: "藤田茜" }],
    ["チップ", { selectedTags: [] }],
    ["解決済みの並び", { sort: "title-asc" }],
    ["検索語", { searchQuery: "x" }],
    ["seed", { seed: 1 }],
  ])("%sが変わるとキーが変わる", (_label, patch) => {
    expect(buildWorksResetKey({ ...base, ...patch })).not.toBe(buildWorksResetKey(base));
  });
});
