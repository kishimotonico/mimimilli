import { describe, it, expect } from "vitest";
import { SORT_OPTIONS } from "../../src/features/library/model/types";

describe("types constants", () => {
  it("has correct sort options", () => {
    expect(SORT_OPTIONS.length).toBe(9);
    expect(SORT_OPTIONS.map((o) => o.id)).toContain("added-desc");
    expect(SORT_OPTIONS.map((o) => o.id)).toContain("random");
  });
});
