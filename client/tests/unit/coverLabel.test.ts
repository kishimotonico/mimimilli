import { describe, expect, it } from "vitest";
import { coverFieldsFromColumns } from "@mimimilli/shared";
import { formatCoverEditLabel, formatCoverInfoLabel } from "../../src/shared/lib/coverLabel";

describe("coverFieldsFromColumns", () => {
  it("画像なしは none", () => {
    expect(coverFieldsFromColumns(null, null, null)).toEqual({
      cover: null,
      coverKind: "none",
      coverImage: null,
    });
  });

  it("寸法欠損は unmeasured", () => {
    expect(coverFieldsFromColumns("cover.jpg", null, null)).toEqual({
      cover: null,
      coverKind: "unmeasured",
      coverImage: "cover.jpg",
    });
  });

  it("寸法ありは measured", () => {
    expect(coverFieldsFromColumns("cover.jpg", 800, 600)).toEqual({
      cover: { image: "cover.jpg", dimensions: { width: 800, height: 600 } },
      coverKind: "measured",
      coverImage: "cover.jpg",
    });
  });
});

describe("formatCoverEditLabel", () => {
  it("3状態を区別して表示する", () => {
    expect(formatCoverEditLabel({ coverKind: "none", coverImage: null })).toBe("なし");
    expect(
      formatCoverEditLabel({
        coverKind: "unmeasured",
        coverImage: "cover.jpg",
      }),
    ).toBe("cover.jpg（計測できません）");
    expect(
      formatCoverEditLabel({
        coverKind: "measured",
        coverImage: "cover.jpg",
      }),
    ).toBe("cover.jpg");
  });
});

describe("formatCoverInfoLabel", () => {
  it("情報表示向けラベルを返す", () => {
    expect(formatCoverInfoLabel("none")).toBe("なし");
    expect(formatCoverInfoLabel("unmeasured")).toBe("あり（計測できません）");
    expect(formatCoverInfoLabel("measured")).toBe("あり");
  });
});
