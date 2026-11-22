// スマートフォルダーの作品一覧のページ蓄積（追加読み込み）と、要求への条件の渡し方の検証。
// useSuspenseLibraryWorks の useSuspenseInfiniteQuery により、page=1 取得後に fetchNextPage() で
// page=2 が連結され、解決済みの sort と（random のときだけ）seed が全ページで変わらない。

import { createElement, Suspense, type ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WORKS_DEFAULT_PAGE_SIZE, type WorkListItem } from "@mimimilli/shared";
import { createInitialAppRoute } from "../../src/entities/navigation/model/appRoute";
import type { LibraryRoute } from "../../src/entities/navigation/model/appRoute";
import { resolveLibraryView } from "../../src/entities/library/resolveLibraryView";
import { useSuspenseLibraryWorks } from "../../src/features/library/model/useLibraryQueries";
import { mockApi, type ApiMock } from "../helpers/api";
import { buildWorkListItem, buildWorksPage } from "../helpers/builders";
import { defaultSmartFolderItems } from "../helpers/smartFolders";

const FOLDER_WORKS_ROUTE = "GET /api/smart-folders/:id/works";

function worksView(patch: Partial<LibraryRoute> = {}) {
  const library: LibraryRoute = { ...createInitialAppRoute().library, seed: 42_195, ...patch };
  const view = resolveLibraryView(library, defaultSmartFolderItems());
  if (view.kind !== "works") throw new Error("作品一覧のビューが必要です");
  return view;
}

function makeWork(id: string): WorkListItem {
  return buildWorkListItem({ id, title: `作品 ${id}`, totalDurationSec: 60 });
}

function installApi(options: { total?: number } = {}): ApiMock {
  const { total = WORKS_DEFAULT_PAGE_SIZE + 50 } = options;
  return mockApi({
    [FOLDER_WORKS_ROUTE]: ({ url }) => {
      const page = Number(url.searchParams.get("page") ?? 1);
      const start = (page - 1) * WORKS_DEFAULT_PAGE_SIZE;
      const count = Math.max(0, Math.min(WORKS_DEFAULT_PAGE_SIZE, total - start));
      const items = Array.from({ length: count }, (_, i) => makeWork(`p${page}-w${i + 1}`));
      return buildWorksPage(items, { total });
    },
    "GET /api/tag-prefixes": [],
    "GET /api/tags": [],
  });
}

function newWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(Suspense, { fallback: null }, children),
    );
  return { queryClient, wrapper };
}

function renderWorks(view: ReturnType<typeof worksView>, searchQuery = "") {
  const { wrapper } = newWrapper();
  return renderHook(() => useSuspenseLibraryWorks(view, searchQuery), { wrapper });
}

describe("ライブラリ作品一覧のページング", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = installApi();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("page=1 取得後に fetchNextPage() で page=2 が連結される", async () => {
    const total = WORKS_DEFAULT_PAGE_SIZE + 50;
    api = installApi({ total });

    const { result } = renderWorks(worksView());

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).some((u) => u.includes("page=1"))).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.works).toHaveLength(total));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).filter((u) => u.includes("page=2"))).toHaveLength(1);

    const ids = result.current.works.map((w) => w.id);
    expect(ids[0]).toBe("p1-w1");
    expect(ids[WORKS_DEFAULT_PAGE_SIZE - 1]).toBe(`p1-w${WORKS_DEFAULT_PAGE_SIZE}`);
    expect(ids[WORKS_DEFAULT_PAGE_SIZE]).toBe("p2-w1");
    expect(ids.at(-1)).toBe("p2-w50");
  });

  it("全件取得後は hasNextPage が false になる", async () => {
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE + 50 });
    const { result } = renderWorks(worksView());

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it("解決済みの sort をフォルダーの works に必ず渡す（「すべて」の既定、今の並び）", async () => {
    const { result } = renderWorks(worksView());
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("/api/smart-folders/all/works?");
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("sort=added-desc");

    const { result: current } = renderWorks(worksView({ sort: "title-asc" }));
    await waitFor(() => expect(current.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).at(-1)).toContain("sort=title-asc");
  });

  it("random のときだけ library.seed を送り、page=2 にも引き継ぐ", async () => {
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE + 50 });
    const { result } = renderWorks(worksView({ folderId: "random" }));

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    const urls = api.urlsTo(FOLDER_WORKS_ROUTE);
    expect(urls[0]).toContain("/api/smart-folders/random/works?");
    expect(urls[0]).toContain("sort=random");
    expect(urls[0]).toContain("seed=42195");
    const page2 = urls.filter((u) => u.includes("page=2"));
    expect(page2).toHaveLength(1);
    expect(page2[0]).toContain("seed=42195");
  });

  it("random 以外の並びでは seed を送らない", async () => {
    const { result } = renderWorks(worksView());
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).every((u) => !u.includes("seed="))).toBe(true);
  });

  it("今の並びが random のときも、他のフォルダーで seed を送る", async () => {
    const { result } = renderWorks(worksView({ sort: "random" }));
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("seed=42195");
  });

  it("seed を変えると別クエリとして再取得し（並べ直す）、元の seed へ戻ると同じキャッシュを使う", async () => {
    api = installApi({ total: WORKS_DEFAULT_PAGE_SIZE });
    let view = worksView({ folderId: "random", seed: 111 });
    const { wrapper } = newWrapper();
    const { result, rerender } = renderHook(() => useSuspenseLibraryWorks(view, ""), { wrapper });

    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).at(-1)).toContain("seed=111");

    view = worksView({ folderId: "random", seed: 222 });
    rerender();
    await waitFor(() =>
      expect(api.urlsTo(FOLDER_WORKS_ROUTE).some((u) => u.includes("seed=222"))).toBe(true),
    );

    const callsBefore = api.urlsTo(FOLDER_WORKS_ROUTE).length;
    view = worksView({ folderId: "random", seed: 111 });
    rerender();
    await waitFor(() => expect(result.current.works).toHaveLength(WORKS_DEFAULT_PAGE_SIZE));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).length).toBe(callsBefore);
  });
});

describe("作品一覧への条件の渡し方", () => {
  let api: ApiMock;

  beforeEach(() => {
    api = installApi({ total: 3 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("選択中のチップを tags として渡し、tagOp は送らない", async () => {
    const { result } = renderWorks(worksView({ selectedTags: ["cv/藤田茜"] }));
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));

    const url = api.urlsTo(FOLDER_WORKS_ROUTE)[0]!;
    expect(url).toContain("tags=cv%2F");
    expect(url).not.toContain("tagOp");
  });

  it("year 擬似タグも tags として渡す（サーバー側で解釈する）", async () => {
    const { result } = renderWorks(worksView({ selectedTags: ["@year/2024"] }));
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("tags=%40year%2F2024");
  });

  it("作品検索 q を渡し、空文字なら含めない", async () => {
    const { result } = renderWorks(worksView(), "藤田茜");
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("q=" + encodeURIComponent("藤田茜"));

    api.clear();
    const { result: empty } = renderWorks(worksView(), "");
    await waitFor(() => expect(empty.current.works.length).toBeGreaterThan(0));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE).every((u) => !u.includes("q="))).toBe(true);
  });

  it("グループの値を group として渡す", async () => {
    const { result } = renderWorks(worksView({ folderId: "by-cv", group: "藤田茜" }));
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    const url = api.urlsTo(FOLDER_WORKS_ROUTE)[0]!;
    expect(url).toContain("/api/smart-folders/by-cv/works?");
    expect(url).toContain("group=" + encodeURIComponent("藤田茜"));
  });

  it("q・チップが変わるとクエリキーが変わり、別クエリとしてフェッチし直す", async () => {
    const { queryClient, wrapper } = newWrapper();
    const { result, rerender } = renderHook(
      ({ view, q }: { view: ReturnType<typeof worksView>; q: string }) =>
        useSuspenseLibraryWorks(view, q),
      { wrapper, initialProps: { view: worksView(), q: "" } },
    );
    await waitFor(() => expect(result.current.works.length).toBeGreaterThan(0));
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();

    rerender({ view: worksView(), q: "藤田茜" });
    await waitFor(() => expect(api.urlsTo(FOLDER_WORKS_ROUTE)).toHaveLength(1));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("q=" + encodeURIComponent("藤田茜"));

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    api.clear();
    rerender({ view: worksView({ selectedTags: ["cv/藤田茜"] }), q: "藤田茜" });
    await waitFor(() => expect(api.urlsTo(FOLDER_WORKS_ROUTE)).toHaveLength(1));
    expect(api.urlsTo(FOLDER_WORKS_ROUTE)[0]).toContain("tags=cv%2F");
  });
});
