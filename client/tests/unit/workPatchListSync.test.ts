// PATCH 後の一覧キャッシュ同期（3層設計）。
// アクティブ一覧は直接更新または reset、非表示キャッシュは stale 化のみ。

import { createElement, Suspense, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKS_DEFAULT_PAGE_SIZE, type Work, type WorkListItem } from "@mimimilli/shared";
import { WORK_QUERY_KEYS } from "../../src/entities/work/queryKeys";
import { SETTINGS_QUERY_KEYS } from "../../src/entities/settings/queryKeys";
import {
  useLibraryWorkPatchMutations,
  useLibrarySupportingQueries,
  useSuspenseNormalLibraryWorks,
} from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { mockApi, type ApiMock } from "../helpers/api";
import {
  buildResolvedPlaylist,
  buildSettings,
  buildWork,
  buildWorkEditSnapshotOf,
  buildWorkListItem,
  buildWorkSourceMutationResult,
  buildWorksPage,
} from "../helpers/builders";

const baseNav: LibraryViewState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: "p1-w1",
  sort: "added-desc",
};

function makeWorkListItem(id: string, title = `作品 ${id}`): WorkListItem {
  return buildWorkListItem({ id, title, totalDurationSec: 60 });
}

function makeWorkDetail(id: string, title = `作品 ${id}`): Work {
  const playlist = buildResolvedPlaylist(1, ["track"]);
  return buildWork({
    id,
    title,
    physicalPath: `/lib/${id}`,
    totalDurationSec: 60,
    defaultPlaylistId: playlist.id,
    playlists: [playlist],
  });
}

function installApi(total = WORKS_DEFAULT_PAGE_SIZE + 50) {
  const worksById = new Map<string, WorkListItem>();
  const detailsById = new Map<string, Work>();

  const api = mockApi({
    "GET /api/works": ({ url }) => {
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = WORKS_DEFAULT_PAGE_SIZE;
      const start = (page - 1) * pageSize;
      const count = Math.max(0, Math.min(pageSize, total - start));
      const items: WorkListItem[] = Array.from({ length: count }, (_, i) => {
        const id = `p${page}-w${i + 1}`;
        if (!worksById.has(id)) worksById.set(id, makeWorkListItem(id));
        return worksById.get(id)!;
      });
      return buildWorksPage(items, { total });
    },
    "PATCH /api/works/:id/bookmark": ({ params, body }) => {
      const id = params.id!;
      const { bookmarked } = body as { bookmarked: boolean };
      const current = detailsById.get(id) ?? makeWorkDetail(id);
      const updated = { ...current, bookmarked };
      detailsById.set(id, updated);
      const listItem = worksById.get(id) ?? makeWorkListItem(id, updated.title);
      listItem.bookmarked = bookmarked;
      worksById.set(id, listItem);
      return { bookmarked };
    },
    "PATCH /api/works/:id": ({ params, body }) => {
      const id = params.id!;
      const patch = body as Record<string, unknown>;
      const current = detailsById.get(id) ?? makeWorkDetail(id);
      const updated: Work = {
        ...current,
        ...(patch.title !== undefined ? { title: patch.title as string } : {}),
        ...(patch.tags !== undefined ? { tags: patch.tags as string[] } : {}),
        ...(patch.urls !== undefined ? { urls: patch.urls as Work["urls"] } : {}),
      };
      detailsById.set(id, updated);
      const listItem = makeWorkListItem(id, updated.title);
      listItem.bookmarked = updated.bookmarked;
      worksById.set(id, listItem);
      return buildWorkSourceMutationResult(buildWorkEditSnapshotOf(updated, "revision-2"));
    },
    "GET /api/works/:id": ({ params }) => {
      const id = params.id!;
      const detail = detailsById.get(id) ?? makeWorkDetail(id);
      if (!detailsById.has(id)) detailsById.set(id, detail);
      return detail;
    },
    "GET /api/tag-prefixes": [],
    "GET /api/tags": [],
    "GET /api/smart-folders": [],
    "GET /api/settings": buildSettings({ rootFolder: "/lib" }),
  });

  return { api, worksById, detailsById };
}

function worksCallUrls(api: ApiMock): string[] {
  return api.urlsTo("GET /api/works");
}

function renderLibraryHooks(nav: LibraryViewState, options?: { queryClient?: QueryClient }) {
  const queryClient =
    options?.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
  queryClient.setQueryData(SETTINGS_QUERY_KEYS.all(), buildSettings({ rootFolder: "/lib" }));
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(
        JotaiProvider,
        { store: createStore() },
        createElement(Suspense, { fallback: null }, children),
      ),
    );
  const hook = renderHook(
    () => {
      const works = useSuspenseNormalLibraryWorks(nav, "");
      const supporting = useLibrarySupportingQueries(nav);
      const workPatchMutations = useLibraryWorkPatchMutations(nav, "");
      return { ...works, ...supporting, workPatchMutations };
    },
    { wrapper },
  );
  return { ...hook, queryClient };
}

describe("作品 PATCH 後の一覧キャッシュ同期", () => {
  let api: ApiMock;
  let detailsById: Map<string, Work>;

  beforeEach(() => {
    const mock = installApi();
    api = mock.api;
    detailsById = mock.detailsById;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("タイトル変更後は閲覧一覧を invalidate して再フェッチし、新しいタイトルが出る", async () => {
    const { result } = renderLibraryHooks(baseNav);

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE + 50));

    const worksCallsBeforePatch = worksCallUrls(api).length;

    await act(async () => {
      await result.current.workPatchMutations.editMutation.mutateAsync({
        workId: "p1-w1",
        sourceRevision: "revision-1",
        title: "更新後タイトル",
      });
    });

    await waitFor(() => {
      expect(worksCallUrls(api).length).toBeGreaterThan(worksCallsBeforePatch);
    });
    await waitFor(() => {
      expect(result.current.works.find((w) => w.id === "p1-w1")?.title).toBe("更新後タイトル");
    });
    await waitFor(() => {
      expect(result.current.selectedWork?.title).toBe("更新後タイトル");
    });
  });

  it("ブックマークPATCH後もresumeはサーバーの最新値へ差し替わらずキャッシュ側を維持する（resumeはPATCHと別経路のため）", async () => {
    const { result } = renderLibraryHooks(baseNav);

    await waitFor(() => expect(result.current.selectedWork).not.toBeNull());
    expect(result.current.selectedWork?.resume).toBeNull();

    // 実際の再生中は POST /works/:id/resume の周期保存でサーバー側 resume だけが
    // 進む（クライアントキャッシュへは同期されない）。ここではその状況を、
    // 次回PATCHレスポンスに含まれる detailsById の resume を直接書き換えて模す。
    const driftedResume = {
      playlistId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      trackId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      offsetSec: 5025,
    };
    const currentDetail = detailsById.get("p1-w1") ?? makeWorkDetail("p1-w1");
    detailsById.set("p1-w1", { ...currentDetail, resume: driftedResume });

    await act(async () => {
      await result.current.workPatchMutations.bookmarkMutation.mutateAsync({
        workId: "p1-w1",
        bookmarked: true,
      });
    });

    await waitFor(() => expect(result.current.selectedWork?.bookmarked).toBe(true));
    // bookmarked（PATCHが実際に指定したフィールド）は反映されるが、PATCHが
    // 触れていない resume はドリフトを取り込まずクライアントキャッシュの値を維持する
    expect(result.current.selectedWork?.resume).toBeNull();
  });

  it("ブックマーク解除（all ビュー）では非表示 fav キャッシュが stale 化されネットワークは発火しない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const favKey = WORK_QUERY_KEYS.list({ sort: "added-desc", view: "fav" });
    const favWork = makeWorkListItem("p1-w1");
    favWork.bookmarked = true;
    queryClient.setQueryData(favKey, {
      pages: [{ items: [favWork], total: 1 }],
      pageParams: [{ page: 1, seed: undefined }],
    });

    const { result } = renderLibraryHooks(baseNav, { queryClient });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    const worksCallsBeforePatch = worksCallUrls(api).length;

    await act(async () => {
      await result.current.workPatchMutations.bookmarkMutation.mutateAsync({
        workId: "p1-w1",
        bookmarked: false,
      });
    });

    expect(worksCallUrls(api).length).toBe(worksCallsBeforePatch);
    expect(worksCallUrls(api).some((u) => u.includes("view=fav"))).toBe(false);

    const favQuery = queryClient.getQueryCache().find({ queryKey: favKey });
    expect(favQuery?.isStale()).toBe(true);
    expect(favQuery?.state.data).toMatchObject({
      pages: [{ items: [{ id: "p1-w1", bookmarked: true }] }],
    });

    await waitFor(() => {
      expect(result.current.works.find((w) => w.id === "p1-w1")?.bookmarked).toBe(false);
    });
  });

  it("ブックマーク変更（fav ビュー）ではアクティブ一覧のみ reset され非表示キャッシュは消えない", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });
    const allKey = WORK_QUERY_KEYS.list({ sort: "added-desc" });
    const allMarker = makeWorkListItem("all-marker");
    queryClient.setQueryData(allKey, {
      pages: [{ items: [allMarker], total: 1 }],
      pageParams: [{ page: 1, seed: undefined }],
    });

    const nav: LibraryViewState = { ...baseNav, activeAxis: "fav" };
    const { result } = renderLibraryHooks(nav, { queryClient });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));

    const worksCallsBeforePatch = worksCallUrls(api).length;

    await act(async () => {
      await result.current.workPatchMutations.bookmarkMutation.mutateAsync({
        workId: "p1-w1",
        bookmarked: false,
      });
    });

    await waitFor(() => expect(worksCallUrls(api).length).toBeGreaterThan(worksCallsBeforePatch));
    expect(worksCallUrls(api).some((u) => u.includes("view=fav") && u.includes("page=1"))).toBe(
      true,
    );
    expect(
      worksCallUrls(api).some(
        (u) => !u.includes("view=fav") && !u.includes("limit=1") && u.includes("page=1"),
      ),
    ).toBe(false);

    const allQuery = queryClient.getQueryCache().find({ queryKey: allKey, exact: true });
    expect(allQuery?.state.data).toMatchObject({
      pages: [{ items: [{ id: "all-marker" }] }],
    });
  });
});
