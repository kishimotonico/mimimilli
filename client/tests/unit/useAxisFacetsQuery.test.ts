// TASK-187: 軸ファセット取得（GET /axes/:axis）が自軸除外後のフィルタをクエリへ渡し、
// フィルタが変わるとクエリキーが変わって再フェッチされる（キャッシュ分離）ことを検証する。

import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAxisFacetsQuery } from "../../src/features/library/model/useAxisFacetsQuery";

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

function createFetchMock() {
  return vi.fn((input: RequestInfo | URL) => {
    const url = new URL(urlOf(input), "http://localhost");
    if (url.pathname.startsWith("/api/axes/")) {
      return Promise.resolve(jsonResponse([]));
    }
    return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
  });
}

function axesCallUrls(fetchMock: ReturnType<typeof createFetchMock>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => urlOf(input))
    .filter((u) => u.includes("/api/axes/"));
}

function renderFacets(axis: string | null, selectedTags: string[]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return renderHook(
    ({ axis, selectedTags }: { axis: string | null; selectedTags: string[] }) =>
      useAxisFacetsQuery(axis, selectedTags),
    { wrapper, initialProps: { axis, selectedTags } },
  );
}

describe("useAxisFacetsQuery の自軸除外フィルタ適用（TASK-187）", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("軸X由来の選択タグは除外し、他軸のフィルタはクエリへ渡す", async () => {
    const { result } = renderFacets("cv", ["cv/藤田茜", "サークル/月白製作所"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const urls = axesCallUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/api/axes/cv?");
    expect(urls[0]).not.toContain("cv%2F"); // 自軸(cv)由来の選択タグは含まれない
    expect(urls[0]).toContain("tags=");
  });

  it("フィルタが自軸だけなら無絞り込みでフェッチする（クエリ文字列なし）", async () => {
    const { result } = renderFacets("cv", ["cv/藤田茜"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const urls = axesCallUrls(fetchMock);
    expect(urls[0]).toBe("/api/axes/cv");
  });

  it("selectedTags（フィルタ）が変わるとクエリキーが変わり、別クエリとして再フェッチする", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(QueryClientProvider, { client: queryClient }, children);

    const { result, rerender } = renderHook(
      ({ selectedTags }: { selectedTags: string[] }) => useAxisFacetsQuery("cv", selectedTags),
      { wrapper, initialProps: { selectedTags: [] as string[] } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(axesCallUrls(fetchMock)).toHaveLength(1);

    rerender({ selectedTags: ["サークル/月白製作所"] });

    await waitFor(() => expect(axesCallUrls(fetchMock)).toHaveLength(2));
    expect(axesCallUrls(fetchMock).at(-1)).toContain("tags=");
  });
});
