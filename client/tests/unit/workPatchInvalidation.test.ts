import { describe, expect, it } from "vitest";
import { getWorkPatchInvalidationTargets } from "../../src/features/library/model/workPatchInvalidation";

describe("getWorkPatchInvalidationTargets", () => {
  it("invalidates only the works list when just the title changes", () => {
    expect(getWorkPatchInvalidationTargets({ title: "新しいタイトル" })).toEqual({
      works: true,
      facets: false,
      smartFolderWorks: false,
      tags: false,
    });
  });

  it("invalidates works/facets/smartFolders/tags when tags change", () => {
    expect(getWorkPatchInvalidationTargets({ tags: ["ASMR"] })).toEqual({
      works: true,
      facets: true,
      smartFolderWorks: true,
      tags: true,
    });
  });

  it("invalidates only the works list when bookmarked changes (no smart folder rule filters on it)", () => {
    expect(getWorkPatchInvalidationTargets({ bookmarked: true })).toEqual({
      works: true,
      facets: false,
      smartFolderWorks: false,
      tags: false,
    });
  });

  it("invalidates nothing for an empty patch", () => {
    expect(getWorkPatchInvalidationTargets({})).toEqual({
      works: false,
      facets: false,
      smartFolderWorks: false,
      tags: false,
    });
  });
});
