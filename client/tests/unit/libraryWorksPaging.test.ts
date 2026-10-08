// 通常 works 一覧のページ蓄積（追加読み込み）の検証。
// useSuspenseNormalLibraryWorks の useSuspenseInfiniteQuery により、page=1 取得後に fetchNextPage()
// で page=2 が連結され、random ソート時は seed が引き継がれることを検証する。

import { createElement, Suspense, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKS_DEFAULT_PAGE_SIZE } from "@mimimilli/shared";
import { useSuspenseNormalLibraryWorks } from "../../src/features/library/model/useLibraryQueries";
import { randomSeedAtom } from "../../src/features/library/model/atoms";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import type { WorkListItem } from "@mimimilli/shared";
import { mockApi, type ApiMock } from "../helpers/api";
import { buildWorkListItem, buildWorksPage } from "../helpers/builders";

const baseNav: LibraryViewState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
};

function makeWork(id: string): WorkListItem {
  return buildWorkListItem({ id, title: `作品 ${id}`, totalDurationSec: 60 });
}

function installApi(options: { total?: number; randomSeed?: number } = {}): ApiMock {
  const { total = WORKS_DEFAULT_PAGE_SIZE + 50, randomSeed } = options;
  return mockApi({
    "GET /api/works": ({ url }) => {
      const page = Number(url.searchParams.get("page") ?? 1);
      const sort = url.searchParams.get("sort") ?? "added-desc";
      const pageSize = WORKS_DEFAULT_PAGE_SIZE;
      const start = (page - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      const items: WorkListItem[] = Array.from({ length: count }, (_, i) =>
        makeWork(`p${page}-w${i + 1}`),
      );
      return buildWorksPage(items, {
        total,
        ...(page === 1 && sort === "random" && randomSeed !== undefined && { seed: randomSeed }),
      });
    },
    "GET /api/tag-prefixes": [],
    "GET /api/tags": [],
    "GET /api/smart-folders": [],
  });
}

function renderWorks(
  nav: LibraryViewState,
  initialQuery = "",
  store: ReturnType<typeof createStore> = createStore(),
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store },
        createElement(Suspense, { fallback: null }, children),
      ),
    );
  return renderHook(({ q }: { q: string }) => useSuspenseNormalLibraryWorks(nav, q), {
    wrapper,
    initialProps: { q: initialQuery },
  });
}

describe("ライブラリ works 一覧のページング", () => {
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
    expect(api.urlsTo("GET /api/works").some((u) => u.includes("page=1"))).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(total));

    const urls = api.urlsTo("GET /api/works");
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
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE + 50, randomSeed: 42_195 });

    const nav: LibraryViewState = { ...baseNav, sort: "random" };
    const { result } = renderWorks(nav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    const page2Urls = api.urlsTo("GET /api/works").filter((u) => u.includes("page=2"));
    expect(page2Urls).toHaveLength(1);
    expect(page2Urls[0]).toContain("seed=42195");
  });

  it("random ソート時、page=1 のリクエストに randomSeedAtom の値を送る", async () => {
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE, randomSeed: 999 });

    const store = createStore();
    store.set(randomSeedAtom, 12_345);
    const nav: LibraryViewState = { ...baseNav, sort: "random" };
    const { result } = renderWorks(nav, "", store);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    const page1Urls = api.urlsTo("GET /api/works").filter((u) => u.includes("page=1"));
    expect(page1Urls[0]).toContain("seed=12345");
  });

  it("random ソート時、randomSeedAtom を変えるとqueryKeyが変わり別クエリとして再取得する（再シャッフル）", async () => {
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE, randomSeed: 999 });

    const store = createStore();
    store.set(randomSeedAtom, 111);
    const nav: LibraryViewState = { ...baseNav, sort: "random" };
    const { result, rerender } = renderHook(() => useSuspenseNormalLibraryWorks(nav, ""), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          QueryClientProvider,
          { client: new QueryClient({ defaultOptions: { queries: { retry: false } } }) },
          createElement(
            JotaiProvider,
            { store },
            createElement(Suspense, { fallback: null }, children),
          ),
        ),
    });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    const urlsBefore = api.urlsTo("GET /api/works").filter((u) => u.includes("page=1"));
    expect(urlsBefore.at(-1)).toContain("seed=111");

    act(() => {
      store.set(randomSeedAtom, 222);
    });
    rerender();

    await waitFor(() => {
      const urls = api
        .urlsTo("GET /api/works")
        .filter((u) => u.includes("page=1") && u.includes("seed=222"));
      expect(urls.length).toBeGreaterThan(0);
    });
  });
});
