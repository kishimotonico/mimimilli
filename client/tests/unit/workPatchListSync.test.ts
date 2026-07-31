// TASK-153: PATCH 後の一覧キャッシュ同期（3層設計）。
// アクティブ一覧は直接更新または reset、非表示キャッシュは stale 化のみ。

import { createElement, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  WORKS_DEFAULT_PAGE_SIZE,
  emptyDlsiteState,
  type Work,
  type WorkListItem,
} from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { useLibraryQueries } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";

const baseNav: LibraryViewState = {
  activeAxis: "all",
  drillValue: null,
  selectedTags: [],
  selectedWorkId: "p1-w1",
  sort: "added-desc",
};

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function makeWorkListItem(id: string, title = `作品 ${id}`): WorkListItem {
  return {
    id,
    title,
    cover: null,
    status: "ok",
    totalDurationSec: 60,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
  };
}

function makeWorkDetail(id: string, title = `作品 ${id}`): Work {
  const playlistId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  return {
    id,
    title,
    cover: null,
    coverKind: "none",
    coverImage: null,
    status: "ok",
    physicalPath: `/lib/${id}`,
    totalDurationSec: 60,
    addedAt: "2025-01-01T00:00:00.000Z",
    errorMessage: null,
    urls: [],
    tags: [],
    bookmarked: false,
    lastPlayedAt: null,
    dlsite: emptyDlsiteState(),
    defaultPlaylistId: playlistId,
    createdAt: null,
    playlists: [
      {
        id: playlistId,
        name: "default",
        tracks: [
          {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            title: "track",
            file: "track.mp3",
            durationSec: 60,
            durationKind: "resolved",
          },
        ],
      },
    ],
    resume: null,
  };
}

function createFetchMock(total = WORKS_DEFAULT_PAGE_SIZE + 50) {
  const worksById = new Map<string, WorkListItem>();
  const detailsById = new Map<string, Work>();

  return {
    worksById,
    detailsById,
    fetchMock: vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(urlOf(input), "http://localhost");
      const path = url.pathname;

      if (path === "/api/works") {
        const page = Number(url.searchParams.get("page") ?? 1);
        const pageSize = WORKS_DEFAULT_PAGE_SIZE;
        const start = (page - 1) * pageSize;
        const count = Math.max(0, Math.min(pageSize, total - start));
        const items: WorkListItem[] = Array.from({ length: count }, (_, i) => {
          const id = `p${page}-w${i + 1}`;
          if (!worksById.has(id)) worksById.set(id, makeWorkListItem(id));
          return worksById.get(id)!;
        });
        return Promise.resolve(
          jsonResponse({ items, total, stats: { trackCount: 0, durationSec: 0 } }),
        );
      }

      const workIdMatch = path.match(/^\/api\/works\/([^/]+)$/);
      if (workIdMatch) {
        const id = workIdMatch[1];
        if (init?.method === "PATCH") {
          const body = JSON.parse(init.body as string) as Record<string, unknown>;
          const current = detailsById.get(id) ?? makeWorkDetail(id);
          const updated: Work = {
            ...current,
            ...(body.title !== undefined ? { title: body.title as string } : {}),
            ...(body.bookmarked !== undefined ? { bookmarked: body.bookmarked as boolean } : {}),
            ...(body.tags !== undefined ? { tags: body.tags as string[] } : {}),
          };
          detailsById.set(id, updated);
          const listItem = makeWorkListItem(id, updated.title);
          listItem.bookmarked = updated.bookmarked;
          worksById.set(id, listItem);
          return Promise.resolve(jsonResponse(updated));
        }
        const detail = detailsById.get(id) ?? makeWorkDetail(id);
        if (!detailsById.has(id)) detailsById.set(id, detail);
        return Promise.resolve(jsonResponse(detail));
      }

      if (path === "/api/tag-prefixes") return Promise.resolve(jsonResponse([]));
      if (path === "/api/tags") return Promise.resolve(jsonResponse([]));
      if (path === "/api/smart-folders") return Promise.resolve(jsonResponse([]));

      return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
    }),
  };
}

function isWorksListUrl(input: string): boolean {
  return new URL(input, "http://localhost").pathname === "/api/works";
}

function worksCallUrls(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map(([input]) => urlOf(input)).filter((u) => isWorksListUrl(u));
}

function renderUseLibraryQueries(nav: LibraryViewState, options?: { queryClient?: QueryClient }) {
  const queryClient =
    options?.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store: createStore() }, children),
    );
  const hook = renderHook(() => useLibraryQueries(nav, ""), { wrapper });
  return { ...hook, queryClient };
}

describe("作品 PATCH 後の一覧キャッシュ同期", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const mock = createFetchMock();
    fetchMock = mock.fetchMock;
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("タイトル変更（影響しない条件）ではアクティブ一覧のみ更新し再フェッチしない", async () => {
    const { result, queryClient } = renderUseLibraryQueries(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE + 50));

    const worksCallsBeforePatch = worksCallUrls(fetchMock).length;

    await act(async () => {
      await result.current.patchWorkMutation.mutateAsync({
        workId: "p1-w1",
        body: { title: "更新後タイトル" },
      });
    });

    expect(worksCallUrls(fetchMock).length).toBe(worksCallsBeforePatch);
    await waitFor(() => {
      expect(result.current.works.find((w) => w.id === "p1-w1")?.title).toBe("更新後タイトル");
    });
    expect(result.current.selectedWork?.title).toBe("更新後タイトル");

    const worksQueries = queryClient.getQueryCache().findAll({ queryKey: ["works"] });
    const activeInfinite = worksQueries.find((q) =>
      Array.isArray((q.state.data as { pages?: unknown })?.pages),
    );
    expect(activeInfinite?.getObserversCount()).toBeGreaterThan(0);
    expect(activeInfinite?.isStale()).toBe(false);
  });

  it("ブックマーク解除（all ビュー）では非表示 fav キャッシュが stale 化されネットワークは発火しない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const favKey = WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" });
    const favWork = makeWorkListItem("p1-w1");
    favWork.bookmarked = true;
    queryClient.setQueryData(favKey, {
      pages: [{ items: [favWork], total: 1 }],
      pageParams: [{ page: 1, seed: undefined }],
    });

    const { result } = renderUseLibraryQueries(baseNav, { queryClient });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    const worksCallsBeforePatch = worksCallUrls(fetchMock).length;

    await act(async () => {
      await result.current.patchWorkMutation.mutateAsync({
        workId: "p1-w1",
        body: { bookmarked: false },
      });
    });

    expect(worksCallUrls(fetchMock).length).toBe(worksCallsBeforePatch);
    expect(worksCallUrls(fetchMock).some((u) => u.includes("view=fav"))).toBe(false);

    const favQuery = queryClient.getQueryCache().find({ queryKey: favKey });
    expect(favQuery?.isStale()).toBe(true);
    expect(favQuery?.state.data).toMatchObject({
      pages: [{ items: [{ id: "p1-w1", bookmarked: true }] }],
    });

    await waitFor(() => {
      expect(result.current.works.find((w) => w.id === "p1-w1")?.bookmarked).toBe(false);
    });
  });

  it("ブックマーク変更（fav ビュー）ではアクティブ一覧のみ reset され非表示キャッシュは消えない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const allKey = WORK_QUERY_KEYS.list({ sort: "added-desc" });
    const allMarker = makeWorkListItem("all-marker");
    queryClient.setQueryData(allKey, {
      pages: [{ items: [allMarker], total: 1 }],
      pageParams: [{ page: 1, seed: undefined }],
    });

    const nav: LibraryViewState = { ...baseNav, activeAxis: "fav" };
    const { result } = renderUseLibraryQueries(nav, { queryClient });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    const worksCallsBeforePatch = worksCallUrls(fetchMock).length;

    await act(async () => {
      await result.current.patchWorkMutation.mutateAsync({
        workId: "p1-w1",
        body: { bookmarked: false },
      });
    });

    await waitFor(() =>
      expect(worksCallUrls(fetchMock).length).toBeGreaterThan(worksCallsBeforePatch),
    );
    expect(
      worksCallUrls(fetchMock).some((u) => u.includes("view=fav") && u.includes("page=1")),
    ).toBe(true);
    expect(
      worksCallUrls(fetchMock).some(
        (u) => !u.includes("view=fav") && !u.includes("limit=1") && u.includes("page=1"),
      ),
    ).toBe(false);

    const allQuery = queryClient.getQueryCache().find({ queryKey: allKey, exact: true });
    expect(allQuery?.state.data).toMatchObject({
      pages: [{ items: [{ id: "all-marker" }] }],
    });
  });
});
