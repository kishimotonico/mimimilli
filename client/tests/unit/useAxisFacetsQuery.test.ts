// 軸ファセット取得（GET /axes/:axis）が渡された selectedTags をそのままAND条件として
// クエリへ渡す（軸による除外はしない）ことを検証する。件数基準（どのタグを渡すか）は
// 呼び出し側の責務で、このフック自体は素通しするだけ。

import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAxisFacetsQuery } from "../../src/features/library/model/useAxisFacetsQuery";
import { mockApi, type ApiMock } from "../helpers/api";

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

describe("useAxisFacetsQuery のタグ素通し", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = mockApi({ "GET /api/axes/:axis": [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selectedTagsを軸に関わらずそのままAND条件として渡す（自軸除外はしない）", async () => {
    const { result } = renderFacets("cv", ["cv/藤田茜", "サークル/月白製作所"]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const urls = api.urlsTo("GET /api/axes/:axis");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("/api/axes/cv?");
    expect(urls[0]).toContain("cv%2F"); // 自軸(cv)由来の選択タグも渡される
    expect(urls[0]).toContain("tags=");
  });

  it("selectedTagsが空なら無絞り込みでフェッチする（クエリ文字列なし）", async () => {
    const { result } = renderFacets("cv", []);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const urls = api.urlsTo("GET /api/axes/:axis");
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
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();

    rerender({ selectedTags: ["サークル/月白製作所"] });

    await waitFor(() => expect(api.urlsTo("GET /api/axes/:axis")).toHaveLength(1));
    expect(api.urlsTo("GET /api/axes/:axis")[0]).toContain("tags=");
  });
});
