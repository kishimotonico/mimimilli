// TASK-61: 検索クエリのデバウンスと AbortSignal 伝播の検証。
// 実際の fetch 呼び出し回数・URL・signal をモック経由で検証する。

import { createElement, Suspense } from "react";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useLibraryDebouncedSearchQuery,
  useSuspenseNormalLibraryWorks,
} from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";

const nav: LibraryViewState = {
  activeAxis: "all",
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

/** 契約を満たす空レスポンスを即時返す fetch モック */
function createFetchMock() {
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = urlOf(input);
    if (url.startsWith("/api/works"))
      return Promise.resolve(
        jsonResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
      );
    if (url.startsWith("/api/tag-prefixes")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/tags")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/smart-folders")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

function worksCallUrls(fetchMock: ReturnType<typeof createFetchMock>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => urlOf(input))
    .filter((u) => u.startsWith("/api/works"));
}

function renderWorks(initialQuery: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function WorksQuery({ query }: { query: string }) {
    useSuspenseNormalLibraryWorks(nav, query);
    return null;
  }
  function SearchProbe({ query }: { query: string }) {
    const debouncedQuery = useLibraryDebouncedSearchQuery(query);
    return createElement(
      Suspense,
      { fallback: null },
      createElement(WorksQuery, { query: debouncedQuery }),
    );
  }
  const tree = (query: string) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store: createStore() }, createElement(SearchProbe, { query })),
    );
  const rendered = render(tree(initialQuery));
  return { ...rendered, rerender: ({ q }: { q: string }) => rendered.rerender(tree(q)) };
}

describe("ライブラリ検索のデバウンス", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("短時間に連続入力しても、待機後の最新値で1回だけリクエストされる", () => {
    const { rerender } = renderWorks("");
    // マウント時の初回クエリ（検索語なし等）をリセット
    fetchMock.mockClear();

    rerender({ q: "あ" });
    rerender({ q: "あい" });
    rerender({ q: "あいう" });
    // デバウンス待機中は新たな検索リクエストが発行されない
    expect(worksCallUrls(fetchMock)).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    const urls = worksCallUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/api/works?q=${encodeURIComponent("あいう")}`);
  });

  it("検索クリア（空文字）はデバウンスなしで即時リクエストされる", () => {
    const { rerender } = renderWorks("あいう");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    fetchMock.mockClear();

    rerender({ q: "" });
    // タイマーを進めずとも即時発行される
    const urls = worksCallUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain("q=");
  });

  it("queryFn の AbortSignal が fetch へ伝播される", () => {
    renderWorks("");
    const init = fetchMock.mock.calls.find(([input]) => urlOf(input).startsWith("/api/works"))?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});
