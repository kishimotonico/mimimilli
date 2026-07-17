import { describe, expect, it } from "vitest";
import {
  countGridColumns,
  getNextGridIndex,
  getNextJustifiedIndex,
} from "../../src/features/library/model/gridNavigation";

describe("library grid keyboard navigation", () => {
  it("counts columns from the first rendered row", () => {
    expect(countGridColumns([])).toBe(0);
    expect(countGridColumns([16, 16, 16, 220, 220, 220])).toBe(3);
    expect(countGridColumns([16, 16, 16])).toBe(3);
  });

  it("moves horizontally by one and vertically by the rendered column count", () => {
    expect(getNextGridIndex(4, "ArrowLeft", 3, 8)).toBe(3);
    expect(getNextGridIndex(4, "ArrowRight", 3, 8)).toBe(5);
    expect(getNextGridIndex(4, "ArrowUp", 3, 8)).toBe(1);
    expect(getNextGridIndex(4, "ArrowDown", 3, 8)).toBe(7);
  });

  it("keeps focus within the available tiles on incomplete edge rows", () => {
    expect(getNextGridIndex(0, "ArrowLeft", 3, 8)).toBe(0);
    expect(getNextGridIndex(1, "ArrowUp", 3, 8)).toBe(1);
    expect(getNextGridIndex(6, "ArrowDown", 3, 8)).toBe(6);
    expect(getNextGridIndex(7, "ArrowRight", 3, 8)).toBe(7);
  });
});

describe("justified grid keyboard navigation", () => {
  // 行0: index 0,1,2（centerX 10,30,50） / 行1: index 3,4（centerX 20,48、等距離を避けた配置）
  const tiles = [
    { rowIndex: 0, centerX: 10 },
    { rowIndex: 0, centerX: 30 },
    { rowIndex: 0, centerX: 50 },
    { rowIndex: 1, centerX: 20 },
    { rowIndex: 1, centerX: 48 },
  ];

  it("moves left/right by display order regardless of row shape", () => {
    expect(getNextJustifiedIndex(tiles, 1, "ArrowRight")).toBe(2);
    expect(getNextJustifiedIndex(tiles, 1, "ArrowLeft")).toBe(0);
    expect(getNextJustifiedIndex(tiles, 0, "ArrowLeft")).toBe(0);
    expect(getNextJustifiedIndex(tiles, 4, "ArrowRight")).toBe(4);
  });

  it("moves up/down to the tile whose row-relative centerX is nearest", () => {
    // index1 (centerX 30) の下は、行1のうち近い方（|30-20|=10 < |30-48|=18）→ index3
    expect(getNextJustifiedIndex(tiles, 1, "ArrowDown")).toBe(3);
    // index4 (centerX 48) の上は、行0のうち近い方（|48-50|=2 が最小）→ index2
    expect(getNextJustifiedIndex(tiles, 4, "ArrowUp")).toBe(2);
  });

  it("stays put when there is no adjacent row", () => {
    expect(getNextJustifiedIndex(tiles, 0, "ArrowUp")).toBe(0);
    expect(getNextJustifiedIndex(tiles, 3, "ArrowDown")).toBe(3);
  });

  it("returns the current index for an out-of-range start", () => {
    expect(getNextJustifiedIndex(tiles, 99, "ArrowRight")).toBe(99);
    expect(getNextJustifiedIndex([], 0, "ArrowDown")).toBe(0);
  });
});
