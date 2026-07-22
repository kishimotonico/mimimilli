import { describe, expect, it } from "vitest";
import { shouldLoadMore } from "../../src/features/library/model/virtualScroll";

describe("virtualScroll shouldLoadMore", () => {
  it("returns false when no virtual items are rendered", () => {
    expect(shouldLoadMore([], 100, 5)).toBe(false);
  });

  it("returns false when the last rendered item is far from the end", () => {
    expect(shouldLoadMore([{ index: 0 }], 100, 5)).toBe(false);
    expect(shouldLoadMore([{ index: 80 }], 100, 5)).toBe(false);
    expect(shouldLoadMore([{ index: 90 }], 100, 5)).toBe(false);
  });

  it("returns true when the last rendered item is within overscan of the end", () => {
    expect(shouldLoadMore([{ index: 94 }], 100, 5)).toBe(true);
    expect(shouldLoadMore([{ index: 95 }], 100, 5)).toBe(true);
    expect(shouldLoadMore([{ index: 99 }], 100, 5)).toBe(true);
  });

  it("handles edge case where count is less than or equal to overscan", () => {
    expect(shouldLoadMore([{ index: 0 }], 1, 5)).toBe(true);
    expect(shouldLoadMore([{ index: 4 }], 5, 5)).toBe(true);
  });
});
