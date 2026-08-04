// TASK doc-4 R2: 分類軸切替時に件数見出しが直前の軸の値のまま固着するという報告
// （CV→タグで「タグ 8 件」のまま本文「タグがありません」）の機序を、
// useLibrarySupportingQueries が返す facetItems の実際の再レンダリング系列を記録して検証する。
import { createElement, type ReactNode } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLibrarySupportingQueries } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";

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

const baseNav: LibraryViewState = {
  activeAxis: "cv",
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
};

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = new URL(urlOf(input), "http://localhost");
    const path = url.pathname;
    if (path === "/api/axes/cv") {
      return Promise.resolve(
        jsonResponse(
          Array.from({ length: 8 }, (_, i) => ({
            value: `cv${i}`,
            count: 1,
            durationSec: 0,
            covers: [],
          })),
        ),
      );
    }
    if (path === "/api/axes/tag") {
      return Promise.resolve(jsonResponse([]));
    }
    if (path === "/api/works") {
      return Promise.resolve(
        jsonResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
      );
    }
    if (path === "/api/tag-prefixes") return Promise.resolve(jsonResponse([]));
    if (path === "/api/tags") return Promise.resolve(jsonResponse([]));
    if (path === "/api/smart-folders") return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
  });
}

describe("分類軸切替時の facetItems 系列（R2 機序調査）", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CV(8件)からタグ(0件)へ切替えても、activeAxis=='tag' の描画で facetItems が8件のまま観測されることはない", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const history: Array<{ axis: string; facetItemsLength: number }> = [];

    function Probe({ nav }: { nav: LibraryViewState }) {
      const { facetItems } = useLibrarySupportingQueries(nav);
      history.push({ axis: nav.activeAxis, facetItemsLength: facetItems.length });
      return null;
    }

    function Wrapper({ children }: { children: ReactNode }) {
      return createElement(
        QueryClientProvider,
        { client: queryClient },
        createElement(JotaiProvider, { store: createStore() }, children),
      );
    }

    const { rerender } = render(
      createElement(Wrapper, null, createElement(Probe, { nav: baseNav })),
    );

    await waitFor(() =>
      expect(history.some((h) => h.axis === "cv" && h.facetItemsLength === 8)).toBe(true),
    );

    const navTag: LibraryViewState = { ...baseNav, activeAxis: "tag" };
    await act(async () => {
      rerender(createElement(Wrapper, null, createElement(Probe, { nav: navTag })));
    });

    await waitFor(() =>
      expect(history.some((h) => h.axis === "tag" && h.facetItemsLength === 0)).toBe(true),
    );

    // ファセットは作品結果とは独立したクエリなので、タグ軸描画にCV軸の項目を混在させない。
    const staleTagRenders = history.filter((h) => h.axis === "tag" && h.facetItemsLength === 8);
    expect(staleTagRenders).toEqual([]);
  });
});
