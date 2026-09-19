import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import {
  getLibraryInvalidationKeys,
  invalidateLibraryQueries,
} from "../../src/features/scan/model/libraryInvalidation";

describe("invalidateLibraryQueries", () => {
  it("スキャン・登録・解除による無効化で、スマートフォルダーの件数プレビューも無効化される", async () => {
    const queryClient = new QueryClient();
    const rules = [{ axis: "circle", op: "eq", value: "circle-1" }];
    const previewKey = SMART_FOLDER_QUERY_KEYS.preview(rules);
    queryClient.setQueryData(previewKey, 3);

    await invalidateLibraryQueries(queryClient);

    expect(queryClient.getQueryState(previewKey)?.isInvalidated).toBe(true);
  });
});

describe("getLibraryInvalidationKeys", () => {
  it("作品一覧・軸件数・DLsite通知・スマートフォルダーのキーを含める", () => {
    const keys = getLibraryInvalidationKeys();
    expect(keys).toContainEqual(["works"]);
    expect(keys).toContainEqual(["axisFacets"]);
    expect(keys).toContainEqual(["dlsiteNotifications"]);
    expect(keys).toContainEqual(["smartFolderWorks"]);
  });

  it("件数プレビューのキーは smartFolderWorks 配下にある", () => {
    const keys = getLibraryInvalidationKeys();
    const previewKey = SMART_FOLDER_QUERY_KEYS.preview({ any: true });
    expect(keys.some((key) => key.every((segment, i) => segment === previewKey[i]))).toBe(true);
  });
});
