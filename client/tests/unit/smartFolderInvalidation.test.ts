import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import {
  getSmartFolderSaveInvalidationKeys,
  invalidateSmartFolderSaveQueries,
} from "../../src/features/library/model/smartFolderInvalidation";

describe("invalidateSmartFolderSaveQueries", () => {
  it("フォルダー保存後、そのフォルダー条件付きのファセットキャッシュが無効化される", async () => {
    const queryClient = new QueryClient();
    const scopedFacetKey = WORK_QUERY_KEYS.scopedFacets("folder-1", "circle");
    queryClient.setQueryData(scopedFacetKey, []);

    await invalidateSmartFolderSaveQueries(queryClient, "folder-1");

    expect(queryClient.getQueryState(scopedFacetKey)?.isInvalidated).toBe(true);
  });

  it("通常の（フォルダー非依存の）軸ファセットは無効化しない", async () => {
    const queryClient = new QueryClient();
    const normalFacetKey = WORK_QUERY_KEYS.facets("circle");
    queryClient.setQueryData(normalFacetKey, []);

    await invalidateSmartFolderSaveQueries(queryClient, "folder-1");

    expect(queryClient.getQueryState(normalFacetKey)?.isInvalidated).toBeFalsy();
  });

  it("対象フォルダー以外のスコープ付きファセットは無効化しない", async () => {
    const queryClient = new QueryClient();
    const otherFolderFacetKey = WORK_QUERY_KEYS.scopedFacets("folder-2", "circle");
    queryClient.setQueryData(otherFolderFacetKey, []);

    await invalidateSmartFolderSaveQueries(queryClient, "folder-1");

    expect(queryClient.getQueryState(otherFolderFacetKey)?.isInvalidated).toBeFalsy();
  });
});

describe("getSmartFolderSaveInvalidationKeys", () => {
  it("フォルダー一覧・フォルダー内作品一覧・そのフォルダーのファセット系統を含む", () => {
    const keys = getSmartFolderSaveInvalidationKeys("folder-1");
    expect(keys).toContainEqual(SMART_FOLDER_QUERY_KEYS.all());
    expect(keys).toContainEqual(SMART_FOLDER_QUERY_KEYS.allWorks());
    expect(keys).toContainEqual(WORK_QUERY_KEYS.allScopedFacets("folder-1"));
  });
});
