// TASK doc-4 R2: グループ分けの切替時に件数見出しが直前の値のまま固着するという報告
// （CV→タグで「タグ 8 件」のまま本文「タグがありません」）の機序を、
// useLibrarySupportingQueries が返す groupValueItems の実際の再レンダリング系列を記録して検証する。
import { createElement, type ReactNode } from "react";
import { act, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLibrarySupportingQueries } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { buildNav } from "./fixtures/libraryNav";
import { mockApi } from "../helpers/api";
import { buildGroupValueItem, buildScanDiagnostics, buildWorksPage } from "../helpers/builders";

const baseNav = buildNav({ library: { folderId: "by-cv" } });

describe("グループ分け切替時の groupValueItems 系列（R2 機序調査）", () => {
  beforeEach(() => {
    mockApi({
      "GET /api/smart-folders/:id/groups": ({ params }) =>
        params.id === "by-cv"
          ? Array.from({ length: 8 }, (_, i) => buildGroupValueItem({ value: `cv${i}` }))
          : [],
      "GET /api/scan/diagnostics": buildScanDiagnostics(),
      "GET /api/smart-folders/:id/works": buildWorksPage(),
      "GET /api/tag-prefixes": [],
      "GET /api/tags": [],
      "GET /api/smart-folders": [],
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("CV別(8件)からタグ別(0件)へ切替えても、タグ別の描画で groupValueItems が8件のまま観測されることはない", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const history: Array<{ folderId: string; groupValueItemsLength: number }> = [];

    function Probe({ nav }: { nav: LibraryViewState }) {
      const { groupValueItems } = useLibrarySupportingQueries(nav, "");
      history.push({ folderId: nav.view.folder.id, groupValueItemsLength: groupValueItems.length });
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
      expect(history.some((h) => h.folderId === "by-cv" && h.groupValueItemsLength === 8)).toBe(
        true,
      ),
    );

    const navTag = buildNav({ library: { folderId: "by-tag" } });
    await act(async () => {
      rerender(createElement(Wrapper, null, createElement(Probe, { nav: navTag })));
    });

    await waitFor(() =>
      expect(history.some((h) => h.folderId === "by-tag" && h.groupValueItemsLength === 0)).toBe(
        true,
      ),
    );

    // グループの値は作品結果とは独立したクエリなので、タグ別の描画にCV別の項目を混在させない。
    const staleTagRenders = history.filter(
      (h) => h.folderId === "by-tag" && h.groupValueItemsLength === 8,
    );
    expect(staleTagRenders).toEqual([]);
  });
});
