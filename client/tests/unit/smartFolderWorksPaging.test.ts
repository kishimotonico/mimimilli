// スマートフォルダー軸の作品一覧ページ蓄積（追加読み込み）の検証。
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
import { mockApi, type ApiMock } from "../helpers/api";
import { buildSmartFolder, buildWorkListItem, buildWorksPage } from "../helpers/builders";

const SMART_FOLDER_ID = "sf-1";
const FOLDER_WORKS_ROUTE = "GET /api/smart-folders/:id/works";

const baseNav: LibraryViewState = {
  activeAxis: `smart-${SMART_FOLDER_ID}`,
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
};

function makeWork(id: string): WorkListItem {
  return buildWorkListItem({ id, title: `作品 ${id}`, totalDurationSec: 60 });
}

function installApi(
  options: { total?: number; randomSeed?: number; folderSort?: "added-desc" | "random" } = {},
): ApiMock {
  const { total = WORKS_DEFAULT_PAGE_SIZE + 50, randomSeed, folderSort = "added-desc" } = options;
  return mockApi({
    [FOLDER_WORKS_ROUTE]: ({ url }) => {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = WORKS_DEFAULT_PAGE_SIZE;
      const start = (page - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      const items: WorkListItem[] = Array.from({ length: count }, (_, i) =>
        makeWork(`p${page}-w${i + 1}`),
      );
      return buildWorksPage(items, {
        total,
        ...(page === 1 &&
          folderSort === "random" &&
          randomSeed !== undefined && { seed: randomSeed }),
      });
    },
    "GET /api/smart-folders": [
      buildSmartFolder({ id: SMART_FOLDER_ID, name: "テストスマートフォルダー", sort: folderSort }),
    ],
    "GET /api/tag-prefixes": [],
    "GET /api/tags": [],
  });
}

function smartFolderCallUrls(api: ApiMock): string[] {
  return api.urlsTo(FOLDER_WORKS_ROUTE);
}

function renderWorks(nav: LibraryViewState, searchQuery = "") {
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
  return renderHook(() => useSuspenseSmartLibraryWorks(nav, searchQuery), { wrapper });
}

describe("スマートフォルダー軸のページング", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = installApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("page=1 取得後に fetchNextPage() で page=2 が連結される", async () => {
    const total = WORKS_DEFAULT_PAGE_SIZE + 50;
    api = installApi({ total });

    const { result } = renderWorks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(smartFolderCallUrls(api).some((u) => u.includes("page=1"))).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(total));

    const urls = smartFolderCallUrls(api);
    expect(urls.filter((u) => u.includes("page=2"))).toHaveLength(1);

    const ids = result.current.works.map((w) => w.id);
    expect(ids[0]).toBe("p1-w1");
    expect(ids[WORKS_DEFAULT_PAGE_SIZE - 1]).toBe(`p1-w${WORKS_DEFAULT_PAGE_SIZE}`);
    expect(ids[WORKS_DEFAULT_PAGE_SIZE]).toBe("p2-w1");
    expect(ids.at(-1)).toBe("p2-w50");
  });

  it("全件取得後は hasNextPage が false になる", async () => {
    const total = WORKS_DEFAULT_PAGE_SIZE + 50;
    api = installApi({ total });

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
    api = installApi({
      total: WORKS_DEFAULT_PAGE_SIZE + 50,
      randomSeed: 42_195,
      folderSort: "random",
    });

    const { result } = renderWorks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    const page2Urls = smartFolderCallUrls(api).filter((u) => u.includes("page=2"));
    expect(page2Urls).toHaveLength(1);
    expect(page2Urls[0]).toContain("seed=42195");
  });
});

describe("スマートフォルダー軸への保持中フィルタの適用", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = installApi({ total: 3 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("選択中の実タグをフォルダーのルールへの追加AND条件としてクエリに渡す", async () => {
    const nav: LibraryViewState = { ...baseNav, selectedTags: ["cv/藤田茜"] };
    const { result } = renderWorks(nav);

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));

    const urls = smartFolderCallUrls(api);
    expect(urls.some((u) => u.includes("tags=cv%2F") && u.includes("tagOp=AND"))).toBe(true);
  });

  it("選択中の year 擬似タグも tags としてクエリに渡す（サーバー側で解釈する）", async () => {
    const nav: LibraryViewState = { ...baseNav, selectedTags: ["@year/2024"] };
    const { result } = renderWorks(nav);

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));

    const urls = smartFolderCallUrls(api);
    expect(urls.some((u) => u.includes("tags=%40year%2F2024"))).toBe(true);
  });

  it("作品検索qをフォルダーのルール全体への追加AND条件としてクエリに渡す", async () => {
    const { result } = renderWorks(baseNav, "藤田茜");

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));

    const urls = smartFolderCallUrls(api);
    expect(urls.some((u) => u.includes("q=" + encodeURIComponent("藤田茜")))).toBe(true);
  });

  it("qが空文字ならクエリパラメータへ含めない", async () => {
    const { result } = renderWorks(baseNav, "");

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));

    const urls = smartFolderCallUrls(api);
    expect(urls.every((u) => !u.includes("q="))).toBe(true);
  });

  it("qが変わるとクエリキーが変わり、別クエリとしてフェッチし直す（キャッシュ分離）", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

    const { result, rerender } = renderHook(
      ({ searchQuery }: { searchQuery: string }) =>
        useSuspenseSmartLibraryWorks(baseNav, searchQuery),
      { wrapper, initialProps: { searchQuery: "" } },
    );

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();

    rerender({ searchQuery: "藤田茜" });

    await waitFor(() => expect(smartFolderCallUrls(api)).toHaveLength(1));
    expect(smartFolderCallUrls(api)[0]).toContain("q=" + encodeURIComponent("藤田茜"));
  });

  it("フィルタが変わるとクエリキーが変わり、別クエリとしてフェッチし直す（キャッシュ分離）", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
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

    const { result, rerender } = renderHook(
      ({ nav, searchQuery }: { nav: LibraryViewState; searchQuery: string }) =>
        useSuspenseSmartLibraryWorks(nav, searchQuery),
      { wrapper, initialProps: { nav: baseNav, searchQuery: "" } },
    );

    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();

    rerender({ nav: { ...baseNav, selectedTags: ["cv/藤田茜"] }, searchQuery: "" });

    await waitFor(() => expect(smartFolderCallUrls(api)).toHaveLength(1));
    expect(smartFolderCallUrls(api)[0]).toContain("tags=cv%2F");
  });
});
