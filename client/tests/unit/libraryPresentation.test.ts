import { describe, expect, it } from "vitest";
import { ApiRequestError } from "../../src/shared/api/http";
import {
  buildWorksParams,
  computeCollectionStatsDisplay,
  computeIsNoResultsDueToFilter,
  computePreviewMode,
  computeWorksListVisibility,
  getFacetAxisForQuery,
  shouldClearSelectionOnFilterMiss,
  shouldClearSelectionOnWorkNotFound,
} from "../../src/features/library/model/libraryPresentation";

describe("buildWorksParams", () => {
  it("returns null for smart folder axes (handled by a separate query)", () => {
    expect(
      buildWorksParams({
        activeAxis: "smart-abc",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
        drillValue: null,
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
        drillValue: null,
      }),
    ).toBeNull();
  });

  it("sets tags/tagOp only on the tag axis with a selection", () => {
    const params = buildWorksParams({
      activeAxis: "tag",
      sort: "added-desc",
      searchQuery: "",
      selectedTags: ["ASMR", "癒し系"],
      drillValue: null,
    });
    expect(params).toEqual({ sort: "added-desc", tags: ["ASMR", "癒し系"], tagOp: "AND" });
  });

  it("sets view for non-all view axes but not for all", () => {
    expect(
      buildWorksParams({
        activeAxis: "fav",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
        drillValue: null,
      }),
    ).toEqual({ sort: "added-desc", view: "fav" });
    expect(
      buildWorksParams({
        activeAxis: "all",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
        drillValue: null,
      }),
    ).toEqual({ sort: "added-desc" });
  });

  it("sets axis/axisValue when a facet axis is drilled", () => {
    expect(
      buildWorksParams({
        activeAxis: "circle",
        sort: "added-desc",
        searchQuery: "",
        selectedTags: [],
        drillValue: "月白製作所",
      }),
    ).toEqual({ sort: "added-desc", axis: "circle", axisValue: "月白製作所" });
  });
});

describe("getFacetAxisForQuery", () => {
  it("returns the facet axis before drilling", () => {
    expect(getFacetAxisForQuery("circle", null)).toBe("circle");
  });
  it("returns null once drilled (works query takes over)", () => {
    expect(getFacetAxisForQuery("circle", "月白製作所")).toBeNull();
  });
  it("returns the tag axis regardless of drill state", () => {
    expect(getFacetAxisForQuery("tag", null)).toBe("tag");
  });
  it("returns null for view/smart axes", () => {
    expect(getFacetAxisForQuery("all", null)).toBeNull();
    expect(getFacetAxisForQuery("smart-abc", null)).toBeNull();
  });
});

describe("computeWorksListVisibility", () => {
  it("facet axis without a drill shows neither list nor grid", () => {
    expect(computeWorksListVisibility("circle", null, "list")).toEqual({
      showsWorksList: false,
      canShowWorksGrid: false,
      showGrid: false,
    });
  });

  it("facet axis with a drill shows the works list/grid", () => {
    expect(computeWorksListVisibility("circle", "月白製作所", "grid")).toEqual({
      showsWorksList: true,
      canShowWorksGrid: true,
      showGrid: true,
    });
  });

  it("a drilled facet axis always shows the grid, even when viewMode is list", () => {
    expect(computeWorksListVisibility("circle", "月白製作所", "list")).toEqual({
      showsWorksList: true,
      canShowWorksGrid: true,
      showGrid: true,
    });
  });

  it("non-facet axes still respect the list/grid viewMode preference", () => {
    expect(computeWorksListVisibility("all", null, "list").showGrid).toBe(false);
    expect(computeWorksListVisibility("all", null, "grid").showGrid).toBe(true);
  });

  it("tag axis cannot show the grid (checkbox list only)", () => {
    expect(computeWorksListVisibility("tag", null, "grid").canShowWorksGrid).toBe(false);
  });

  it("home axis shows neither the works list nor the grid (dedicated dashboard view)", () => {
    expect(computeWorksListVisibility("home", null, "grid")).toEqual({
      showsWorksList: false,
      canShowWorksGrid: false,
      showGrid: false,
    });
  });
});

describe("computeIsNoResultsDueToFilter", () => {
  it("is false when the axis is just naturally empty (no search/drill)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "", "fav", null, false, false)).toBe(false);
  });
  it("is true when a search query narrows to zero results (query settled: not loading/error)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", "all", null, false, false)).toBe(
      true,
    );
  });
  it("is true when a facet drill narrows to zero results", () => {
    expect(
      computeIsNoResultsDueToFilter(true, 0, "", "circle", "存在しないサークル", false, false),
    ).toBe(true);
  });
  it("is false while the debounced query is still loading, even though works is temporarily empty", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", "all", null, true, false)).toBe(
      false,
    );
  });
  it("is true once the query resolves successfully after loading", () => {
    // 同じパラメータでisWorksLoadingがfalseに変われば（クエリ確定後）通常どおり判定する
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", "all", null, false, false)).toBe(
      true,
    );
  });
  it("is false when the works query errored (0件が確定した結果ではないため)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", "all", null, false, true)).toBe(
      false,
    );
  });
});

describe("computePreviewMode", () => {
  it("prioritizes the no-results message over a stale selected work", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: true,
        selectedWorkId: "w1",
        activeAxis: "all",
        selectedTags: [],
      }),
    ).toBe("empty");
  });

  it("shows work detail once selected and loaded", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: "w1",
        activeAxis: "all",
        selectedTags: [],
      }),
    ).toBe("work");
  });

  it("stays in work mode while the selected work is still loading (no flicker to home/etc.)", () => {
    // selectedWorkIdが立っていればwork詳細データの有無に関わらずworkモードを維持する。
    // 読み込み中/エラーの出し分けはコンポーネント側（PreviewPane/WorkGridInspector）が担う。
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: "w1",
        activeAxis: "circle",
        selectedTags: [],
      }),
    ).toBe("work");
  });

  it("shows empty for an undrilled facet axis (placeholder role dropped in phase 1, ADR-0012 §4)", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        activeAxis: "circle",
        selectedTags: [],
      }),
    ).toBe("empty");
  });

  it("shows smart-folder for smart axes", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        activeAxis: "smart-abc",
        selectedTags: [],
      }),
    ).toBe("smart-folder");
  });

  it("shows home for the home axis regardless of tag/drill state", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        activeAxis: "home",
        selectedTags: [],
      }),
    ).toBe("home");
  });

  it("shows work over home when a work is selected while browsing home", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: "w1",
        activeAxis: "home",
        selectedTags: [],
      }),
    ).toBe("work");
  });

  it("shows tag-results when the tag axis has selected tags", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        activeAxis: "tag",
        selectedTags: ["ASMR"],
      }),
    ).toBe("tag-results");
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
