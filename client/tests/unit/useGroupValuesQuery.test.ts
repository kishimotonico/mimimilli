// 値の候補取得（POST /smart-folders/:id/groups）が渡されたスコープ（フォルダー・値・チップ・検索語）を
// そのまま母集団として送ることを検証する。件数基準（何を渡すか）は呼び出し側の責務で、
// このフック自体は素通しするだけ。

import { createElement, type ReactNode } from "react";
import type { GroupBy, GroupSortId } from "@mimimilli/shared";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useGroupValuesQuery,
  type GroupValueScope,
} from "../../src/features/library/model/useGroupValuesQuery";
import { mockApi, type ApiMock } from "../helpers/api";

const KEY = "POST /api/smart-folders/:id/groups";

function wrapperFor(queryClient: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
}

function renderGroupValues(
  groupBy: GroupBy | null,
  scope: GroupValueScope,
  groupSort: GroupSortId | null = "count-desc",
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderHook(
    ({ groupBy, scope, groupSort }: Props) => useGroupValuesQuery(groupBy, scope, groupSort),
    { wrapper: wrapperFor(queryClient), initialProps: { groupBy, scope, groupSort } },
  );
}

interface Props {
  groupBy: GroupBy | null;
  scope: GroupValueScope;
  groupSort: GroupSortId | null;
}

describe("useGroupValuesQuery のスコープ素通し", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = mockApi({ [KEY]: [] });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("groupBy と、チップ・検索語・グループの値をそのまま送る", async () => {
    const { result } = renderGroupValues(
      { kind: "prefix", prefix: "cv" },
      {
        folderId: "by-circle",
        group: "月白製作所",
        tags: ["cv/藤田茜", "サークル/月白製作所"],
        q: "雨",
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const [request] = api.requestsTo(KEY);
    expect(api.requestsTo(KEY)).toHaveLength(1);
    expect(request?.params.id).toBe("by-circle");
    expect(request?.body).toEqual({
      groupBy: { kind: "prefix", prefix: "cv" },
      groupSort: "count-desc",
      group: "月白製作所",
      tags: ["cv/藤田茜", "サークル/月白製作所"],
      q: "雨",
    });
  });

  it("スコープがフォルダーだけなら絞り込みを送らない", async () => {
    const { result } = renderGroupValues({ kind: "prefix", prefix: "cv" }, { folderId: "by-cv" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(api.requestsTo(KEY)[0]?.body).toEqual({
      groupBy: { kind: "prefix", prefix: "cv" },
      groupSort: "count-desc",
    });
  });

  it("タグ・追加年の groupBy をそのまま送る", async () => {
    const tag = renderGroupValues({ kind: "tag" }, { folderId: "all" });
    await waitFor(() => expect(tag.result.current.isSuccess).toBe(true));
    const year = renderGroupValues({ kind: "addedYear" }, { folderId: "all" });
    await waitFor(() => expect(year.result.current.isSuccess).toBe(true));

    expect(api.requestsTo(KEY).map((request) => request.body)).toEqual([
      { groupBy: { kind: "tag" }, groupSort: "count-desc" },
      { groupBy: { kind: "addedYear" }, groupSort: "count-desc" },
    ]);
  });

  it("値の並びは要求に含め、変わると別クエリとして取り直す", async () => {
    const { result, rerender } = renderGroupValues(
      { kind: "prefix", prefix: "cv" },
      { folderId: "by-cv" },
      "name-asc",
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.requestsTo(KEY)[0]?.body).toMatchObject({ groupSort: "name-asc" });

    rerender({
      groupBy: { kind: "prefix", prefix: "cv" },
      scope: { folderId: "by-cv" },
      groupSort: "last-played",
    });

    await waitFor(() => expect(api.requestsTo(KEY)).toHaveLength(2));
    expect(api.requestsTo(KEY)[1]?.body).toMatchObject({ groupSort: "last-played" });
  });

  it("値の並びが null のときは取得しない", () => {
    renderGroupValues({ kind: "prefix", prefix: "cv" }, { folderId: "by-cv" }, null);

    expect(api.requestsTo(KEY)).toHaveLength(0);
  });

  it("groupBy が null のときは取得しない", () => {
    renderGroupValues(null, { folderId: "all" });

    expect(api.requestsTo(KEY)).toHaveLength(0);
  });

  it("スコープ（フィルタ）が変わるとクエリキーが変わり、別クエリとして再フェッチする", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { result, rerender } = renderHook(
      ({ scope }: { scope: GroupValueScope }) =>
        useGroupValuesQuery({ kind: "prefix", prefix: "cv" }, scope, "count-desc"),
      {
        wrapper: wrapperFor(queryClient),
        initialProps: { scope: { folderId: "all" } as GroupValueScope },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();

    rerender({ scope: { folderId: "all", tags: ["サークル/月白製作所"] } });

    await waitFor(() => expect(api.requestsTo(KEY)).toHaveLength(1));
    expect(api.requestsTo(KEY)[0]?.body).toEqual({
      groupBy: { kind: "prefix", prefix: "cv" },
      groupSort: "count-desc",
      tags: ["サークル/月白製作所"],
    });
  });
});
