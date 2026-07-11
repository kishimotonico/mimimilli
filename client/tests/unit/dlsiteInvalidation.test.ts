import { describe, expect, it } from "vitest";
import { getDlsiteInvalidationKeys } from "../../src/features/library/model/dlsiteInvalidation";

describe("getDlsiteInvalidationKeys", () => {
  it("手動適用では対象作品の詳細を含める", () => {
    expect(getDlsiteInvalidationKeys("work-1")).toContainEqual(["work", "work-1"]);
  });

  it("一括適用では全作品詳細のプレフィックスを含める", () => {
    expect(getDlsiteInvalidationKeys()).toContainEqual(["work"]);
  });
});
