import { describe, it, expect } from "vitest";
import { SORT_OPTIONS, GRID_SIZES, GRID_SIZE_KEYS } from "../../src/features/library/model/types";

describe("types constants", () => {
  it("has correct sort options", () => {
    expect(SORT_OPTIONS.length).toBe(9);
    expect(SORT_OPTIONS.map((o) => o.id)).toContain("added-desc");
    expect(SORT_OPTIONS.map((o) => o.id)).toContain("random");
  });

  it("has correct grid sizes", () => {
    expect(GRID_SIZE_KEYS).toEqual(["S", "M", "L", "XL"]);
    expect(GRID_SIZES.S).toBe(120);
    expect(GRID_SIZES.XL).toBe(260);
  });
});
