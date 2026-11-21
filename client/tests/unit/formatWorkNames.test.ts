import { describe, expect, it } from "vitest";
import { formatWorkNames } from "../../src/features/scan/model/formatWorkNames";

describe("formatWorkNames", () => {
  it("1件は「A」、複数は「A」他N件", () => {
    expect(formatWorkNames(["A"])).toBe("「A」");
    expect(formatWorkNames(["A", "B", "C"])).toBe("「A」他2件");
  });
});
