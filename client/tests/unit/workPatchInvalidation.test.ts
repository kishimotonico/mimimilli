import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import { TAG_QUERY_KEYS } from "../../src/entities/tag/queryKeys";
import { invalidateWorkViewQueries } from "../../src/entities/work/invalidateWorkViewQueries";
import { applyBookmarkToWorkCache } from "../../src/features/library/model/workPatchInvalidation";

const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeWork(overrides: Partial<Work> = {}): Work {
  return {
    id: "w1",
    title: "作品",
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: "/lib/w1",
    totalDurationSec: 120,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [],
    resume: null,
    ...overrides,
  };
}

describe("invalidateWorkViewQueries", () => {
  it("閲覧クエリは stale にし、source キャッシュは残す", async () => {
    const queryClient = new QueryClient();
    const snapshot = {
      sourceRevision: "rev-2",
      id: "w1",
      physicalPath: "/lib/w1",
      title: "新タイトル",
      tags: [],
      urls: [],
      coverImage: null,
      dlsite: emptyDlsiteState(),
    };
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), makeWork());
    queryClient.setQueryData(WORK_QUERY_KEYS.source("w1"), snapshot);
    queryClient.setQueryData(WORK_QUERY_KEYS.list({ sort: "added-desc" }), {
      pages: [],
      pageParams: [],
    });
    queryClient.setQueryData(TAG_QUERY_KEYS.all(), []);
    queryClient.setQueryData(SMART_FOLDER_QUERY_KEYS.allWorks(), { pages: [], pageParams: [] });

    await invalidateWorkViewQueries(queryClient, "w1");

    expect(queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(WORK_QUERY_KEYS.source("w1"))?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(WORK_QUERY_KEYS.source("w1"))).toEqual(snapshot);
    expect(
      queryClient.getQueryState(WORK_QUERY_KEYS.list({ sort: "added-desc" }))?.isInvalidated,
    ).toBe(true);
  });
});

describe("applyBookmarkToWorkCache", () => {
  it("詳細キャッシュの bookmarked だけを更新し resume は触らない", () => {
    const queryClient = new QueryClient();
    const resume = {
      playlistId,
      trackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      offsetSec: 12,
    };
    queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), makeWork({ resume }));
    applyBookmarkToWorkCache(queryClient, "w1", true);
    expect(queryClient.getQueryData<Work>(WORK_QUERY_KEYS.detail("w1"))).toMatchObject({
      bookmarked: true,
      resume,
      title: "作品",
    });
  });
});
