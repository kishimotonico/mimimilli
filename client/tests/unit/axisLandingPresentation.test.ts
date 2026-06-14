import { describe, expect, it } from "vitest";
import { getAxisLandingPresentation } from "../../src/features/library/model/axisLandingPresentation";

describe("getAxisLandingPresentation", () => {
  it("shows the selection instruction before a facet value is selected", () => {
    expect(getAxisLandingPresentation("circle", false)).toEqual({
      panelTitle: "概要",
      sectionTitle: "サークル",
      instruction: "左の列から絞り込みを選択してください",
    });
  });

  it("labels applied tag filtering as results and hides the selection instruction", () => {
    expect(getAxisLandingPresentation("tag", true)).toEqual({
      panelTitle: "絞り込み結果",
      sectionTitle: "タグの結果",
      instruction: null,
    });
  });
});
