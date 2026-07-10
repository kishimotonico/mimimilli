import { describe, expect, it } from "vitest";
import {
  FACET_AXES,
  VIEW_AXES,
  getAxisLabel,
  getSmartFolderId,
  isFacetAxis,
  isSmartAxis,
  isViewAxis,
} from "../../src/features/library/model/axisDefinitions";

describe("axisDefinitions", () => {
  it("classifies view axes", () => {
    expect(isViewAxis("all")).toBe(true);
    expect(isViewAxis("fav")).toBe(true);
    expect(isViewAxis("circle")).toBe(false);
    expect(VIEW_AXES.has("missing")).toBe(true);
  });

  it("classifies facet axes (tag axis is excluded)", () => {
    expect(isFacetAxis("circle")).toBe(true);
    expect(isFacetAxis("year")).toBe(true);
    expect(isFacetAxis("tag")).toBe(false);
    expect(FACET_AXES.has("cv")).toBe(true);
  });

  it("classifies smart folder axes and extracts the id", () => {
    expect(isSmartAxis("smart-abc")).toBe(true);
    expect(isSmartAxis("all")).toBe(false);
    expect(getSmartFolderId("smart-abc")).toBe("abc");
  });

  it("labels known axes and falls back to the raw id for unknown ones", () => {
    expect(getAxisLabel("circle")).toBe("サークル");
    expect(getAxisLabel("tag")).toBe("タグ");
    expect(getAxisLabel("smart-abc")).toBe("スマートフォルダー");
    expect(getAxisLabel("all")).toBe("すべての作品");
  });
});
