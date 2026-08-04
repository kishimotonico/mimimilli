// リストの作品未選択時、右ペインを発見ダッシュボード（最近追加/最近再生/ランダムピック）に差し替える。

import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { WorkListItem } from "@mimimilli/shared";
import { DiscoveryDashboard } from "../../src/features/library/ui/preview/DiscoveryDashboard";
import PreviewPane from "../../src/features/library/ui/PreviewPane";

afterEach(cleanup);

function makeItem(id: string): WorkListItem {
  return {
    id,
    title: `作品 ${id}`,
    cover: null,
    status: "ok",
    totalDurationSec: 120,
    trackCount: 1,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: "サークルA",
  };
}

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

/** sort別に応答を出し分ける /api/works の fetch モック。
 *  recentPlayedEmpty=true のときは sort=last-played を0件で返す。 */
function createFetchMock(options: { recentPlayedEmpty?: boolean } = {}) {
  return vi.fn((input: RequestInfo | URL) => {
    const url = new URL(urlOf(input), "http://localhost");
    if (url.pathname !== "/api/works") {
      return Promise.reject(new Error(`unexpected fetch: ${url.toString()}`));
    }
    const sort = url.searchParams.get("sort");
    if (sort === "last-played" && options.recentPlayedEmpty) {
      return Promise.resolve(
        jsonResponse({ items: [], total: 0, stats: { trackCount: 0, durationSec: 0 } }),
      );
    }
    const items = [makeItem(`${sort}-1`), makeItem(`${sort}-2`)];
    const seed = url.searchParams.get("seed");
    return Promise.resolve(
      jsonResponse({
        items,
        total: items.length,
        stats: { trackCount: items.length, durationSec: 240 },
        ...(seed !== null ? { seed: Number(seed) } : {}),
      }),
    );
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("DiscoveryDashboard", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("3セクション（最近追加・最近再生・ランダムピック）を表示する", async () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(DiscoveryDashboard, {
          stats: { status: "ready", count: 3, trackCount: 5, durationSec: 600 },
          onSelectWork: () => {},
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("最近追加")).toBeTruthy();
      expect(screen.getByText("最近再生")).toBeTruthy();
      expect(screen.getByText("ランダムピック")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.getByText("作品 added-desc-1")).toBeTruthy();
      expect(screen.getByText("作品 last-played-1")).toBeTruthy();
      expect(screen.getByText("作品 random-1")).toBeTruthy();
    });
    expect(screen.getByText(/3作品/)).toBeTruthy();
  });

  it("最近再生が0件のときはセクションごと非表示にする", async () => {
    fetchMock = createFetchMock({ recentPlayedEmpty: true });
    vi.stubGlobal("fetch", fetchMock);

    render(
      createElement(
        Wrapper,
        null,
        createElement(DiscoveryDashboard, {
          stats: { status: "loading" },
          onSelectWork: () => {},
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("作品 added-desc-1")).toBeTruthy();
    });
    await waitFor(() => {
      expect(screen.queryByText("最近再生")).toBeNull();
    });
  });

  it("シャッフルボタンを押すと新しいseedでランダムピックを再取得する", async () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(DiscoveryDashboard, {
          stats: { status: "loading" },
          onSelectWork: () => {},
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("作品 random-1")).toBeTruthy();
    });
    const callsBefore = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "別の作品をピックアップ" }));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it("カードクリックでonSelectWorkが呼ばれる", async () => {
    const onSelectWork = vi.fn();
    render(
      createElement(
        Wrapper,
        null,
        createElement(DiscoveryDashboard, {
          stats: { status: "loading" },
          onSelectWork,
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("作品 added-desc-1")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("作品 added-desc-1"));
    expect(onSelectWork).toHaveBeenCalledWith("added-desc-1");
  });
});

const noop = () => {};
const asyncNoop = async () => {
  throw new Error("not used in this test");
};

// ADR-0012 §3: 結果面のプレースホルダー（未選択・0件）表示は WorkGrid/WorkListPane
// 自身の CollectionStatus が担い、PreviewPane はもう「empty」モードを持たない
// （作品選択時にだけスライドインするため）。PreviewPane は "work" と home 軸専用の
// "home" だけを扱う。

describe("PreviewPane のホームビュー（ADR-0012 §4）", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const basePreviewPaneProps = {
    selectedWork: null,
    isSelectedWorkLoading: false,
    isSelectedWorkError: false,
    playingTrackIndex: null,
    onPlay: noop,
    onResume: noop,
    onTogglePlay: noop,
    onSelectWork: noop,
    onTagClick: noop,
    tagSuggestions: [],
    isPatching: false,
    onPatchWork: asyncNoop,
  };

  it("mode='home' では発見ダッシュボードの3セクションを結果面に表示する", async () => {
    render(
      createElement(
        Wrapper,
        null,
        createElement(PreviewPane, {
          ...basePreviewPaneProps,
          mode: "home",
          homeStats: { status: "ready", count: 3, trackCount: 5, durationSec: 600 },
        }),
      ),
    );

    await waitFor(() => {
      expect(screen.getByText("最近追加")).toBeTruthy();
      expect(screen.getByText("最近再生")).toBeTruthy();
      expect(screen.getByText("ランダムピック")).toBeTruthy();
    });
    expect(screen.getByText(/3作品/)).toBeTruthy();
  });
});
