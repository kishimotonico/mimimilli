// TASK-74: スマートフォルダー軸の作品一覧ページ蓄積（追加読み込み）の検証。
// useSuspenseSmartLibraryWorks の useSuspenseInfiniteQuery により、
// page=1 取得後に fetchNextPage() で page=2 が連結され、random ソート時は seed が引き継がれる。

import { createElement, Suspense, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKS_DEFAULT_PAGE_SIZE } from "@mimimilli/shared";
import { useSuspenseSmartLibraryWorks } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import type { WorkListItem } from "@mimimilli/shared";

const SMART_FOLDER_ID = "sf-1";

const baseNav: LibraryViewState = {
  activeAxis: `smart-${SMART_FOLDER_ID}`,
  selectedTags: [],
  selectedWorkId: null,
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

function makeWork(id: string): WorkListItem {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    status: "ok",
    totalDurationSec: 60,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
  };
}

function createFetchMock(
  options: { total?: number; randomSeed?: number; folderSort?: "added-desc" | "random" } = {},
) {
  const { total = WORKS_DEFAULT_PAGE_SIZE + 50, randomSeed, folderSort = "added-desc" } = options;
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = new URL(urlOf(input), "http://localhost");
    const path = url.pathname;

    if (path === `/api/smart-folders/${SMART_FOLDER_ID}/works`) {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = WORKS_DEFAULT_PAGE_SIZE;
      const start = (page - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      const items: WorkListItem[] = Array.from({ length: count }, (_, i) =>
        makeWork(`p${page}-w${i + 1}`),
      );
      const body: {
        items: WorkListItem[];
        total: number;
        stats: { trackCount: number; durationSec: number };
        seed?: number;
      } = {
        items,
        total,
        stats: { trackCount: 0, durationSec: 0 },
      };
      if (page === 1 && folderSort === "random" && randomSeed !== undefined) {
        body.seed = randomSeed;
      }
      return Promise.resolve(jsonResponse(body));
    }

    if (path === "/api/smart-folders") {
      return Promise.resolve(
        jsonResponse([
          {
            id: SMART_FOLDER_ID,
            name: "テストスマートフォルダー",
            rules: [],
            sort: folderSort,
            createdAt: "2024-01-01T00:00:00Z",
          },
        ]),
      );
    }
    if (path === "/api/tag-prefixes") return Promise.resolve(jsonResponse([]));
    if (path === "/api/tags") return Promise.resolve(jsonResponse([]));

    return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
  });
}

function smartFolderCallUrls(fetchMock: ReturnType<typeof createFetchMock>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => urlOf(input))
    .filter((u) => u.startsWith(`/api/smart-folders/${SMART_FOLDER_ID}/works`));
}

function renderWorks(nav: LibraryViewState, initialQuery = "") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store: createStore() },
        createElement(Suspense, { fallback: null }, children),
      ),
    );
  return renderHook(() => useSuspenseSmartLibraryWorks(nav), {
    wrapper,
    initialProps: { q: initialQuery },
  });
}

describe("スマートフォルダー軸のページング", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("page=1 取得後に fetchNextPage() で page=2 が連結される", async () => {
    const total = WORKS_DEFAULT_PAGE_SIZE + 50;
    fetchMock = createFetchMock({ total });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderWorks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(smartFolderCallUrls(fetchMock).some((u) => u.includes("page=1"))).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(total));

    const urls = smartFolderCallUrls(fetchMock);
    expect(urls.filter((u) => u.includes("page=2"))).toHaveLength(1);

    const ids = result.current.works.map((w) => w.id);
    expect(ids[0]).toBe("p1-w1");
    expect(ids[WORKS_DEFAULT_PAGE_SIZE - 1]).toBe(`p1-w${WORKS_DEFAULT_PAGE_SIZE}`);
    expect(ids[WORKS_DEFAULT_PAGE_SIZE]).toBe("p2-w1");
    expect(ids.at(-1)).toBe("p2-w50");
  });

  it("全件取得後は hasNextPage が false になる", async () => {
    const total = WORKS_DEFAULT_PAGE_SIZE + 50;
    fetchMock = createFetchMock({ total });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderWorks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(total));
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("random ソート時、page=1 の seed が page=2 リクエストに引き継がれる", async () => {
    fetchMock = createFetchMock({
      total: WORKS_DEFAULT_PAGE_SIZE + 50,
      randomSeed: 42_195,
      folderSort: "random",
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderWorks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    const page2Urls = smartFolderCallUrls(fetchMock).filter((u) => u.includes("page=2"));
    expect(page2Urls).toHaveLength(1);
    expect(page2Urls[0]).toContain("seed=42195");
  });
});
