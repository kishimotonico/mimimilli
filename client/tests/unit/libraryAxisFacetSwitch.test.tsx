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
import { buildNav } from "./fixtures/libraryNav";
import { mockApi } from "../helpers/api";
import { buildAxisFacetItem, buildScanDiagnostics, buildWorksPage } from "../helpers/builders";

const baseNav = buildNav({ library: { folderId: "by-cv" } });

describe("分類軸切替時の facetItems 系列（R2 機序調査）", () => {
  beforeEach(() => {
    mockApi({
      "POST /api/smart-folders/:id/groups": ({ params }) =>
        params.id === "by-cv"
          ? Array.from({ length: 8 }, (_, i) => buildAxisFacetItem({ value: `cv${i}` }))
          : [],
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/works": buildWorksPage(),
      "GET /api/tag-prefixes": [],
      "GET /api/tags": [],
      "GET /api/smart-folders": [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CV別(8件)からタグ別(0件)へ切替えても、タグ別の描画で facetItems が8件のまま観測されることはない", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const history: Array<{ folderId: string; facetItemsLength: number }> = [];

    function Probe({ nav }: { nav: LibraryViewState }) {
      const { facetItems } = useLibrarySupportingQueries(nav);
      history.push({ folderId: nav.view.folder.id, facetItemsLength: facetItems.length });
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
      expect(history.some((h) => h.folderId === "by-cv" && h.facetItemsLength === 8)).toBe(true),
    );

    const navTag = buildNav({ library: { folderId: "by-tag" } });
    await act(async () => {
      rerender(createElement(Wrapper, null, createElement(Probe, { nav: navTag })));
    });

    await waitFor(() =>
      expect(history.some((h) => h.folderId === "by-tag" && h.facetItemsLength === 0)).toBe(true),
    );

    // ファセットは作品結果とは独立したクエリなので、タグ別の描画にCV別の項目を混在させない。
    const staleTagRenders = history.filter(
      (h) => h.folderId === "by-tag" && h.facetItemsLength === 8,
    );
    expect(staleTagRenders).toEqual([]);
  });
});
