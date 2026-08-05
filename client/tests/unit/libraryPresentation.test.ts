import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/shared/api/http";
import { nt } from "../helpers/tag";
import {
  axisOfFilterTag,
  buildAxisFacetFilterParams,
  buildFilterTag,
  buildSmartFolderFilterParams,
  buildWorksParams,
  computeCollectionStatsDisplay,
  computeIsNoResultsDueToFilter,
  computeReplacedTags,
  computeResultsPaneKind,
  getFacetAxisForQuery,
  isGridViewActive,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
  tagFilterGroupKey,
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

describe("isGridViewActive", () => {
  it("works・value-list 種の結果面は viewMode のみに従う（強制グリッドは廃止済み）", () => {
    expect(isGridViewActive("all", "list")).toBe(false);
    expect(isGridViewActive("all", "grid")).toBe(true);
    expect(isGridViewActive("smart-abc", "grid")).toBe(true);
    expect(isGridViewActive("circle", "list")).toBe(false);
    expect(isGridViewActive("circle", "grid")).toBe(true);
    expect(isGridViewActive("tag", "grid")).toBe(true);
  });
  it("home 種の結果面はグリッド概念を持たない", () => {
    expect(isGridViewActive("home", "grid")).toBe(false);
  });
});

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

describe("tagFilterGroupKey / axisOfFilterTag（正規化済みタグを前提とする）", () => {
  it("year擬似タグは軸ごとにグループ化・軸特定される", () => {
    expect(tagFilterGroupKey(nt("@year/2024"))).toBe("@year");
    expect(axisOfFilterTag(nt("@year/2024"))).toBe("year");
  });
  it("computeReplacedTags: 同じyear擬似タググループを置き換える", () => {
    expect(computeReplacedTags([nt("@year/2023")], nt("@year/2024"))).toEqual([nt("@year/2024")]);
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

  it("passes a year pseudo-tag through in tags as-is; the server interprets it (ADR-0012 §2, TASK-199)", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["@year/2024"],
      }),
    ).toEqual({ sort: "added-desc", tags: ["@year/2024"], tagOp: "AND" });
  });

  it("combines a real tag filter and a year pseudo-tag filter together in tags", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["cv/藤田茜", "@year/2024"],
      }),
    ).toEqual({
      sort: "added-desc",
      tags: ["cv/藤田茜", "@year/2024"],
      tagOp: "AND",
    });
  });

  it("treats a real tag literally named year/2025 as an exact-match tag, not the addedAt year filter", () => {
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: ["year/2025"],
      }),
    ).toEqual({ sort: "added-desc", tags: ["year/2025"], tagOp: "AND" });
  });
});

describe("buildSmartFolderFilterParams（スマートフォルダー評価APIへの追加AND条件）", () => {
  it("フィルタが無ければキーの無い空オブジェクトを返す（クエリキーの安定のため）", () => {
    expect(buildSmartFolderFilterParams([])).toEqual({});
  });
  it("実タグは tags/tagOp として渡す", () => {
    expect(buildSmartFolderFilterParams(["cv/藤田茜", "サークル/月白製作所"])).toEqual({
      tags: ["cv/藤田茜", "サークル/月白製作所"],
      tagOp: "AND",
    });
  });
  it("year 擬似タグも tags にそのまま渡す（サーバー側で解釈する、TASK-199）", () => {
    expect(buildSmartFolderFilterParams(["@year/2024"])).toEqual({
      tags: ["@year/2024"],
      tagOp: "AND",
    });
  });
  it("実タグとyear擬似タグを同時に渡せる", () => {
    expect(buildSmartFolderFilterParams(["cv/藤田茜", "@year/2024"])).toEqual({
      tags: ["cv/藤田茜", "@year/2024"],
      tagOp: "AND",
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

describe("buildAxisFacetFilterParams（自軸除外カウント）", () => {
  it("軸Xの値一覧では、軸X由来の実タグを除外してから残りをtags/tagOpへ渡す", () => {
    // cv 軸を見ているときは cv/* を除外し、他軸（サークル）のフィルタは残す
    expect(buildAxisFacetFilterParams("cv", ["cv/藤田茜", "サークル/月白製作所"])).toEqual({
      tags: ["サークル/月白製作所"],
      tagOp: "AND",
    });
  });

  it("フラットタグは tag 軸由来として扱う", () => {
    expect(buildAxisFacetFilterParams("tag", ["ASMR", "cv/藤田茜"])).toEqual({
      tags: ["cv/藤田茜"],
      tagOp: "AND",
    });
    expect(buildAxisFacetFilterParams("cv", ["ASMR", "cv/藤田茜"])).toEqual({
      tags: ["ASMR"],
      tagOp: "AND",
    });
  });

  it("year 軸を見ているときは @year 擬似タグを除外し、他のフィルタは axis/axisValue へ残す", () => {
    expect(buildAxisFacetFilterParams("year", ["@year/2024", "cv/藤田茜"])).toEqual({
      tags: ["cv/藤田茜"],
      tagOp: "AND",
    });
  });

  it("他軸を見ているときは year 擬似タグも tags に残す（サーバー側で解釈する）", () => {
    expect(buildAxisFacetFilterParams("cv", ["@year/2024", "サークル/月白製作所"])).toEqual({
      tags: ["@year/2024", "サークル/月白製作所"],
      tagOp: "AND",
    });
  });

  it("軸由来のフィルタしか無ければ空オブジェクトを返す（自軸除外後は無フィルタ集計）", () => {
    expect(buildAxisFacetFilterParams("cv", ["cv/藤田茜", "cv/霧島レイ"])).toEqual({});
  });

  it("フィルタが無ければ空オブジェクトを返す", () => {
    expect(buildAxisFacetFilterParams("cv", [])).toEqual({});
  });
});
