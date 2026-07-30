import { describe, expect, it } from "vitest";
import type { InfiniteData } from "@tanstack/react-query";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { WorksPage } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import {
  patchWorkInQueryCache,
  staleInactiveListCaches,
} from "../../src/features/library/model/workPatchListCache";

describe("patchWorkInQueryCache", () => {
  it("指定クエリの infinite pages 内の該当作品のみ差し替える", () => {
    const queryClient = new QueryClient();
    const params = { sort: "added-desc" as const };
    const queryKey = WORK_QUERY_KEYS.list(params);
    const otherKey = WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" });
    const data: InfiniteData<WorksPage> = {
      pageParams: [{ page: 1, seed: undefined }],
      pages: [
        {
          items: [
            {
              id: "w1",
              title: "旧タイトル",
              cover: null,
              status: "ok",
              totalDurationSec: 60,
              trackCount: 1,
              bookmarked: false,
              lastPlayedAt: null,
              circleName: null,
            },
          ],
          total: 1,
        },
      ],
    };
    queryClient.setQueryData(queryKey, structuredClone(data));
    queryClient.setQueryData(otherKey, structuredClone(data));

    patchWorkInQueryCache(queryClient, queryKey, "w1", {
      id: "w1",
      title: "新タイトル",
      cover: null,
      status: "ok",
      totalDurationSec: 60,
      trackCount: 1,
      bookmarked: true,
      lastPlayedAt: null,
      circleName: "サークル",
    });

    const patched = queryClient.getQueryData<InfiniteData<WorksPage>>(queryKey);
    const untouched = queryClient.getQueryData<InfiniteData<WorksPage>>(otherKey);
    expect(patched?.pages[0].items[0]).toMatchObject({
      title: "新タイトル",
      bookmarked: true,
      circleName: "サークル",
    });
    expect(untouched?.pages[0].items[0].title).toBe("旧タイトル");
  });
});

describe("staleInactiveListCaches", () => {
  it("アクティブ以外の一覧キャッシュを stale 化し refetch は発火しない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const activeKey = WORK_QUERY_KEYS.list({ sort: "added-desc" });
    const inactiveKey = WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" });
    const inactiveSmartKey = SMART_FOLDER_QUERY_KEYS.works("sf-1");

    const pageData: InfiniteData<WorksPage> = {
      pageParams: [{ page: 1, seed: undefined }],
      pages: [{ items: [], total: 0 }],
    };

    queryClient.setQueryData(activeKey, structuredClone(pageData));
    queryClient.setQueryData(inactiveKey, structuredClone(pageData));
    queryClient.setQueryData(inactiveSmartKey, structuredClone(pageData));

    const observer = new QueryObserver(queryClient, {
      queryKey: activeKey,
      queryFn: () => Promise.resolve(pageData),
    });
    const unsubscribe = observer.subscribe(() => {});

    await staleInactiveListCaches(queryClient);

    unsubscribe();

    const activeQuery = queryClient.getQueryCache().find({ queryKey: activeKey });
    const inactiveQuery = queryClient.getQueryCache().find({ queryKey: inactiveKey });
    const inactiveSmartQuery = queryClient.getQueryCache().find({ queryKey: inactiveSmartKey });

    expect(activeQuery?.isStale()).toBe(false);
    expect(inactiveQuery?.isStale()).toBe(true);
    expect(inactiveSmartQuery?.isStale()).toBe(true);
  });
});
