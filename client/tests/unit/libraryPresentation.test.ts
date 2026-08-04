import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/shared/api/http";
import {
  buildFilterTag,
  buildWorksParams,
  computeCollectionStatsDisplay,
  computeIsNoResultsDueToFilter,
  computeResultsPaneKind,
  getFacetAxisForQuery,
  isWorksGridActive,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
  splitSelectedTags,
} from "../../src/features/library/model/libraryPresentation";

describe("computeResultsPaneKind", () => {
  it("home 軸は home", () => {
    expect(computeResultsPaneKind("home")).toBe("home");
  });
  it("facet 軸（prefix・year）は value-list", () => {
    expect(computeResultsPaneKind("circle")).toBe("value-list");
    expect(computeResultsPaneKind("year")).toBe("value-list");
  });
  it("tag 軸は value-list", () => {
    expect(computeResultsPaneKind("tag")).toBe("value-list");
  });
  it("ビュー軸・スマートフォルダー軸は works", () => {
    expect(computeResultsPaneKind("all")).toBe("works");
    expect(computeResultsPaneKind("fav")).toBe("works");
    expect(computeResultsPaneKind("smart-abc")).toBe("works");
  });
});

describe("isWorksGridActive", () => {
  it("works 種の結果面は viewMode のみに従う（強制グリッドは廃止済み）", () => {
    expect(isWorksGridActive("all", "list")).toBe(false);
    expect(isWorksGridActive("all", "grid")).toBe(true);
    expect(isWorksGridActive("smart-abc", "grid")).toBe(true);
  });
  it("value-list・home 種の結果面はグリッド概念を持たない", () => {
    expect(isWorksGridActive("circle", "grid")).toBe(false);
    expect(isWorksGridActive("tag", "grid")).toBe(false);
    expect(isWorksGridActive("home", "grid")).toBe(false);
  });
});

describe("splitSelectedTags", () => {
  it("year 擬似タグを yearValue へ、それ以外は tags へ振り分ける", () => {
    expect(splitSelectedTags(["cv/藤田茜", "year/2024", "サークル/月白製作所"])).toEqual({
      tags: ["cv/藤田茜", "サークル/月白製作所"],
      yearValue: "2024",
    });
  });
  it("year 擬似タグが無ければ yearValue は null", () => {
    expect(splitSelectedTags(["ASMR"])).toEqual({ tags: ["ASMR"], yearValue: null });
  });
  it("year 擬似タグが複数あっても先頭だけを採用する（AND は常に0件になるため）", () => {
    expect(splitSelectedTags(["year/2023", "year/2024"])).toEqual({
      tags: [],
      yearValue: "2023",
    });
  });
});

describe("buildFilterTag", () => {
  it("tag 軸はそのまま返す（値が既に完全なタグ文字列のため）", () => {
    expect(buildFilterTag("tag", "cv/藤田茜")).toBe("cv/藤田茜");
  });
  it("それ以外の facet 軸は 軸/値 の擬似タグを組み立てる", () => {
    expect(buildFilterTag("cv", "藤田茜")).toBe("cv/藤田茜");
    expect(buildFilterTag("year", "2024")).toBe("year/2024");
  });
});

describe("buildWorksParams", () => {
  it("returns null for smart folder axes (handled by a separate query)", () => {
    expect(
      buildWorksParams({
        activeAxis: "smart-abc",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
      }),
    ).toBeNull();
  });

  it("returns null for the home axis (dashboard has its own queries)", () => {
    expect(
      buildWorksParams({
        activeAxis: "home",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
      }),
    ).toBeNull();
  });

  it("returns null for value-list axes (facet/tag axes never show a works list)", () => {
    expect(
      buildWorksParams({
        activeAxis: "tag",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["ASMR"],
      }),
    ).toBeNull();
    expect(
      buildWorksParams({
        activeAxis: "circle",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
      }),
    ).toBeNull();
  });

  it("sets view for non-all view axes but not for all", () => {
    expect(
      buildWorksParams({
        activeAxis: "fav",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
      }),
    ).toEqual({ sort: "added-desc", view: "fav" });
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
      }),
    ).toEqual({ sort: "added-desc" });
  });

  it("sets tags/tagOp when a view axis has selected tags (ADR-0012: filters apply across all axes)", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["cv/藤田茜", "サークル/月白製作所"],
      }),
    ).toEqual({
      sort: "added-desc",
      tags: ["cv/藤田茜", "サークル/月白製作所"],
      tagOp: "AND",
    });
  });

  it("resolves a year pseudo-tag as the built-in axis/axisValue query (ADR-0012 §2)", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["year/2024"],
      }),
    ).toEqual({ sort: "added-desc", axis: "year", axisValue: "2024" });
  });

  it("combines a real tag filter and a year pseudo-tag filter together", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["cv/藤田茜", "year/2024"],
      }),
    ).toEqual({
      sort: "added-desc",
      tags: ["cv/藤田茜"],
      tagOp: "AND",
      axis: "year",
      axisValue: "2024",
    });
  });
});

describe("getFacetAxisForQuery", () => {
  it("returns the axis for value-list axes (facet/tag)", () => {
    expect(getFacetAxisForQuery("circle")).toBe("circle");
    expect(getFacetAxisForQuery("tag")).toBe("tag");
  });
  it("returns null for view/smart/home axes", () => {
    expect(getFacetAxisForQuery("all")).toBeNull();
    expect(getFacetAxisForQuery("smart-abc")).toBeNull();
    expect(getFacetAxisForQuery("home")).toBeNull();
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
