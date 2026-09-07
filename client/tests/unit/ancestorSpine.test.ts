import { describe, expect, it } from "vitest";
import {
  buildAncestorSegments,
  buildAncestorSpineSlots,
} from "../../src/features/files/model/ancestorSpine";

describe("buildAncestorSegments", () => {
  it("addressPathの末尾（現在地）を除いたroot〜現在地の親までを返す", () => {
    expect(buildAncestorSegments(["library", "dlsite", "夜想曲スタジオ", "RJ501010"])).toEqual([
      "library",
      "dlsite",
      "夜想曲スタジオ",
    ]);
  });

  it("root直下（addressPath長1）は空配列", () => {
    expect(buildAncestorSegments(["library"])).toEqual([]);
  });
});

describe("buildAncestorSpineSlots", () => {
  it("空配列は空スロット", () => {
    expect(buildAncestorSpineSlots([])).toEqual([]);
  });

  it("3枚以下はそのまま並べ、最後だけisNearest", () => {
    const slots = buildAncestorSpineSlots(["library", "dlsite"]);
    expect(slots).toEqual([
      { kind: "segment", index: 0, name: "library", isNearest: false },
      { kind: "segment", index: 1, name: "dlsite", isNearest: true },
    ]);
  });

  it("4枚以上は中間を1枚の省略スロットへ畳み、先頭と直近のindexを保持する（AC#2/AC#3）", () => {
    const slots = buildAncestorSpineSlots(["library", "dlsite", "夜想曲スタジオ", "特典"]);
    expect(slots).toEqual([
      { kind: "segment", index: 0, name: "library", isNearest: false },
      {
        kind: "ellipsis",
        collapsed: [
          { index: 1, name: "dlsite" },
          { index: 2, name: "夜想曲スタジオ" },
        ],
      },
      { kind: "segment", index: 3, name: "特典", isNearest: true },
    ]);
  });
});
