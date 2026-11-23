// 値一覧の値と件数は、今のチップと検索語をかけた母集団で数える（ADR-0041）。
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLibrarySupportingQueries } from "../../src/features/library/model/useLibraryQueries";
import { buildNav } from "./fixtures/libraryNav";
import { groupsQueryOf, mockApi } from "../helpers/api";
import { buildGroupValueItem } from "../helpers/builders";
import { nts } from "../helpers/tag";

const KEY = "GET /api/smart-folders/:id/groups";

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("値一覧のクエリの母集団", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("今のチップと間引いた検索語をかける", async () => {
    const api = mockApi({
      [KEY]: [buildGroupValueItem({ value: "藤田茜" })],
      "GET /api/tags": [],
      "GET /api/tag-prefixes": [],
    });
    const nav = buildNav({
      library: { folderId: "by-cv", selectedTags: nts(["ASMR"]), q: "入力中" },
    });

    const { result } = renderHook(() => useLibrarySupportingQueries(nav, "雨"), { wrapper });

    await waitFor(() => expect(result.current.groupValueItems).toHaveLength(1));
    expect(groupsQueryOf(api.requestsTo(KEY)[0]!)).toEqual({
      groupBy: "prefix:cv",
      groupSort: "count-desc",
      tags: ["ASMR"],
      q: "雨",
    });
  });

  it("絞り込みが無ければ何も付けない", async () => {
    const api = mockApi({
      [KEY]: [buildGroupValueItem({ value: "藤田茜" })],
      "GET /api/tags": [],
      "GET /api/tag-prefixes": [],
    });
    const nav = buildNav({ library: { folderId: "by-cv" } });

    const { result } = renderHook(() => useLibrarySupportingQueries(nav, ""), { wrapper });

    await waitFor(() => expect(result.current.groupValueItems).toHaveLength(1));
    expect(groupsQueryOf(api.requestsTo(KEY)[0]!)).toEqual({
      groupBy: "prefix:cv",
      groupSort: "count-desc",
    });
  });
});
