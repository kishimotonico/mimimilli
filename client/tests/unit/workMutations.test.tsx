import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyDlsiteState, type Work } from "@mimimilli/shared";
import * as workApi from "../../src/entities/work/api";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SMART_FOLDER_QUERY_KEYS } from "../../src/entities/smart-folder/queryKeys";
import {
  useBookmarkWorkMutation,
  useEditWorkSourceMutation,
  useUnregisterWorkMutation,
  type ActiveListCacheHandler,
} from "../../src/entities/work/model/workMutations";

afterEach(() => {
  vi.restoreAllMocks();
});

const activeKey = WORK_QUERY_KEYS.list({ sort: "added-desc" });
const otherKey = WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" });
const smartKey = SMART_FOLDER_QUERY_KEYS.works("sf-1");
const emptyPages = { pages: [{ items: [], total: 0 }], pageParams: [{ page: 1 }] };

function makeWork(id: string): Work {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/lib/${id}`,
    totalDurationSec: 0,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: null,
    createdAt: null,
    playlists: [],
    resume: null,
  };
}

function setup() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  queryClient.setQueryData(WORK_QUERY_KEYS.detail("w1"), makeWork("w1"));
  for (const key of [activeKey, otherKey, smartKey]) {
    queryClient.setQueryData(key, structuredClone(emptyPages));
  }
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const isInvalidated = (key: readonly unknown[]) =>
    queryClient.getQueryState(key)?.isInvalidated === true;
  return { queryClient, wrapper, isInvalidated };
}

describe("useBookmarkWorkMutation の表示最適化契約", () => {
  it("activeList を渡すと apply の完了後、その key だけを無効化から外す", async () => {
    vi.spyOn(workApi, "patchWorkBookmark").mockResolvedValue({ bookmarked: true });
    const { wrapper, isInvalidated } = setup();
    const apply = vi.fn<ActiveListCacheHandler["apply"]>(async () => {});
    const { result } = renderHook(
      () => useBookmarkWorkMutation({ activeList: { queryKey: activeKey, apply } }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", bookmarked: true });
    });

    expect(apply).toHaveBeenCalledWith(expect.anything(), { workId: "w1", bookmarked: true });
    expect(isInvalidated(activeKey)).toBe(false);
    expect(isInvalidated(otherKey)).toBe(true);
    expect(isInvalidated(smartKey)).toBe(true);
  });

  it("activeList を渡さなければすべての一覧を無効化する", async () => {
    vi.spyOn(workApi, "patchWorkBookmark").mockResolvedValue({ bookmarked: true });
    const { queryClient, wrapper, isInvalidated } = setup();
    const { result } = renderHook(() => useBookmarkWorkMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workId: "w1", bookmarked: true });
    });

    expect(isInvalidated(activeKey)).toBe(true);
    expect(isInvalidated(otherKey)).toBe(true);
    expect(isInvalidated(smartKey)).toBe(true);
    expect(queryClient.getQueryData<Work>(WORK_QUERY_KEYS.detail("w1"))?.bookmarked).toBe(true);
  });
});

describe("正本変更の失敗", () => {
  it("meta 編集が失敗したら詳細を無効化し、一覧は触らない", async () => {
    vi.spyOn(workApi, "patchWorkSource").mockRejectedValue(new Error("conflict"));
    const { wrapper, isInvalidated } = setup();
    const { result } = renderHook(() => useEditWorkSourceMutation(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ workId: "w1", sourceRevision: "rev-1", title: "新" })
        .catch(() => {});
    });

    expect(isInvalidated(WORK_QUERY_KEYS.detail("w1"))).toBe(true);
    expect(isInvalidated(activeKey)).toBe(false);
  });
});

describe("画面の後処理の順序", () => {
  it("mutate 単位の onSuccess は必須更新の完了後に呼ばれる", async () => {
    vi.spyOn(workApi, "deleteWork").mockResolvedValue(undefined);
    const { queryClient, wrapper, isInvalidated } = setup();
    const { result } = renderHook(() => useUnregisterWorkMutation(), { wrapper });
    const observed: { detailRemoved: boolean; listInvalidated: boolean }[] = [];

    await act(async () => {
      await new Promise<void>((resolve) => {
        result.current.mutate("w1", {
          onSuccess: () => {
            observed.push({
              detailRemoved: queryClient.getQueryState(WORK_QUERY_KEYS.detail("w1")) === undefined,
              listInvalidated: isInvalidated(activeKey),
            });
            resolve();
          },
        });
      });
    });

    expect(observed).toEqual([{ detailRemoved: true, listInvalidated: true }]);
  });
});
