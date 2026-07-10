import { describe, expect, it } from "vitest";
import {
  countGridColumns,
  getNextGridIndex,
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
