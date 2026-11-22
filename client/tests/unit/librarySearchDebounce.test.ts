// 検索クエリのデバウンスと AbortSignal 伝播の検証。
// 実際の fetch 呼び出し回数・URL・signal をモック経由で検証する。

import { createElement, Suspense } from "react";
import { act, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useLibraryDebouncedSearchQuery,
  useSuspenseLibraryWorks,
} from "../../src/features/library/model/useLibraryQueries";
import { buildNav } from "./fixtures/libraryNav";
import { mockApi, type ApiMock } from "../helpers/api";
import { buildWorksPage } from "../helpers/builders";

const FOLDER_WORKS = "GET /api/smart-folders/:id/works";
const { view } = buildNav();
if (view.kind !== "works") throw new Error("作品一覧のビューが必要です");

function renderWorks(initialQuery: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function WorksQuery({ query }: { query: string }) {
    useSuspenseLibraryWorks(view, query);
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
  let api: ApiMock;

  beforeEach(() => {
    vi.useFakeTimers();
    api = mockApi({
      [FOLDER_WORKS]: buildWorksPage(),
      "GET /api/tag-prefixes": [],
      "GET /api/tags": [],
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("短時間に連続入力しても、待機後の最新値で1回だけリクエストされる", () => {
    const { rerender } = renderWorks("");
    // マウント時の初回クエリ（検索語なし等）をリセット
    api.clear();

    rerender({ q: "あ" });
    rerender({ q: "あい" });
    rerender({ q: "あいう" });
    // デバウンス待機中は新たな検索リクエストが発行されない
    expect(api.urlsTo(FOLDER_WORKS)).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    const urls = api.urlsTo(FOLDER_WORKS);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/api/smart-folders/all/works?q=${encodeURIComponent("あいう")}`);
  });

  it("検索クリア（空文字）はデバウンスなしで即時リクエストされる", () => {
    const { rerender } = renderWorks("あいう");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    api.clear();

    rerender({ q: "" });
    // タイマーを進めずとも即時発行される
    const urls = api.urlsTo(FOLDER_WORKS);
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain("q=");
  });

  it("queryFn の AbortSignal が fetch へ伝播される", () => {
    renderWorks("");
    const [request] = api.requestsTo(FOLDER_WORKS);
    expect(request?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});
