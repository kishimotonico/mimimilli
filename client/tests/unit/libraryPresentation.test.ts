import { describe, expect, it } from "vitest";
import {
  buildWorksParams,
  computeIsNoResultsDueToFilter,
  computePreviewMode,
  computeWorksListVisibility,
  getFacetAxisForQuery,
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

  it("tag axis cannot show the grid (checkbox list only)", () => {
    expect(computeWorksListVisibility("tag", null, "grid").canShowWorksGrid).toBe(false);
  });
});

describe("computeIsNoResultsDueToFilter", () => {
  it("is false when the axis is just naturally empty (no search/drill)", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "", "fav", null)).toBe(false);
  });
  it("is true when a search query narrows to zero results", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "存在しない語", "all", null)).toBe(true);
  });
  it("is true when a facet drill narrows to zero results", () => {
    expect(computeIsNoResultsDueToFilter(true, 0, "", "circle", "存在しないサークル")).toBe(true);
  });
});

describe("computePreviewMode", () => {
  it("prioritizes the no-results message over a stale selected work", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: true,
        selectedWorkId: "w1",
        hasSelectedWork: true,
        activeAxis: "all",
        drillValue: null,
        selectedTags: [],
      }),
    ).toBe("empty");
  });

  it("shows work detail once selected and loaded", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: "w1",
        hasSelectedWork: true,
        activeAxis: "all",
        drillValue: null,
        selectedTags: [],
      }),
    ).toBe("work");
  });

  it("shows axis landing for an undrilled facet axis", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        hasSelectedWork: false,
        activeAxis: "circle",
        drillValue: null,
        selectedTags: [],
      }),
    ).toBe("axis-landing");
  });

  it("shows smart-folder for smart axes", () => {
    expect(
      computePreviewMode({
        isNoResultsDueToFilter: false,
        selectedWorkId: null,
        hasSelectedWork: false,
        activeAxis: "smart-abc",
        drillValue: null,
        selectedTags: [],
      }),
    ).toBe("smart-folder");
  });
});
