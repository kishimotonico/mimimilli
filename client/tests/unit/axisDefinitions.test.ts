import { describe, expect, it } from "vitest";
import type { TagPrefix } from "@mimimilli/shared";
import {
  VIEW_AXES,
  getAxisLabel,
  getSmartFolderId,
  isFacetAxis,
  isSmartAxis,
  isViewAxis,
} from "../../src/features/library/model/axisDefinitions";

const PREFIXES: TagPrefix[] = [
  { prefix: "cv", label: "CV", color: null, showAsAxis: true, protected: true },
  { prefix: "サークル", label: "サークル", color: null, showAsAxis: true, protected: true },
];

describe("axisDefinitions", () => {
  it("classifies view axes", () => {
    expect(isViewAxis("all")).toBe(true);
    expect(isViewAxis("fav")).toBe(true);
    expect(isViewAxis("サークル")).toBe(false);
    expect(VIEW_AXES.has("missing")).toBe(true);
  });

  it("classifies facet axes: view・tag・smart 以外はすべてファセット軸（ADR-0005）", () => {
    expect(isFacetAxis("サークル")).toBe(true);
    expect(isFacetAxis("cv")).toBe(true);
    expect(isFacetAxis("year")).toBe(true);
    expect(isFacetAxis("気分")).toBe(true); // 未登録 prefix でも形の上ではファセット軸
    expect(isFacetAxis("tag")).toBe(false);
    expect(isFacetAxis("all")).toBe(false);
    expect(isFacetAxis("smart-abc")).toBe(false);
  });

  it("classifies smart folder axes and extracts the id", () => {
    expect(isSmartAxis("smart-abc")).toBe(true);
    expect(isSmartAxis("all")).toBe(false);
    expect(getSmartFolderId("smart-abc")).toBe("abc");
  });

  it("labels axes from prefix definitions and falls back to the raw id", () => {
    expect(getAxisLabel("サークル", PREFIXES)).toBe("サークル");
    expect(getAxisLabel("cv", PREFIXES)).toBe("CV");
    expect(getAxisLabel("気分", PREFIXES)).toBe("気分"); // 未登録は ID をそのまま
    expect(getAxisLabel("tag")).toBe("タグ");
    expect(getAxisLabel("year")).toBe("追加日");
    expect(getAxisLabel("smart-abc")).toBe("スマートフォルダー");
    expect(getAxisLabel("all")).toBe("すべての作品");
  });
});
