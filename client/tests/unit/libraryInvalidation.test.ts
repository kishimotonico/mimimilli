import { describe, expect, it } from "vitest";
import { getLibraryInvalidationKeys } from "../../src/features/scan/model/libraryInvalidation";

describe("getLibraryInvalidationKeys", () => {
  it("作品一覧・軸件数・DLsite通知・スマートフォルダーのキーを含める", () => {
    const keys = getLibraryInvalidationKeys();
    expect(keys).toContainEqual(["works"]);
    expect(keys).toContainEqual(["axisFacets"]);
    expect(keys).toContainEqual(["dlsiteNotifications"]);
    expect(keys).toContainEqual(["smartFolderWorks"]);
  });
});
