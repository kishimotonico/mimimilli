// TASK-61: 検索クエリのデバウンスと AbortSignal 伝播の検証。
// 実際の fetch 呼び出し回数・URL・signal をモック経由で検証する。

import { createElement, type ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLibraryQueries } from "../../src/features/library/model/useLibraryQueries";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";

const nav: LibraryViewState = {
  activeAxis: "all",
  drillValue: null,
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
  addressPath: [],
};

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

/** 契約を満たす空レスポンスを即時返す fetch モック */
function createFetchMock() {
  return vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = urlOf(input);
    if (url.startsWith("/api/works")) return Promise.resolve(jsonResponse({ items: [], total: 0 }));
    if (url.startsWith("/api/tag-prefixes")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/tags")) return Promise.resolve(jsonResponse([]));
    if (url.startsWith("/api/smart-folders")) return Promise.resolve(jsonResponse([]));
    return Promise.reject(new Error(`unexpected fetch: ${url}`));
  });
}

function worksCallUrls(fetchMock: ReturnType<typeof createFetchMock>): string[] {
  return fetchMock.mock.calls
    .map(([input]) => urlOf(input))
    .filter((u) => u.startsWith("/api/works"));
}

function renderUseLibraryQueries(initialQuery: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(JotaiProvider, { store: createStore() }, children),
    );
  return renderHook(({ q }: { q: string }) => useLibraryQueries(nav, q), {
    wrapper,
    initialProps: { q: initialQuery },
  });
}

describe("ライブラリ検索のデバウンス", () => {
  let fetchMock: ReturnType<typeof createFetchMock>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = createFetchMock();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("短時間に連続入力しても、待機後の最新値で1回だけリクエストされる", () => {
    const { rerender } = renderUseLibraryQueries("");
    // マウント時の初回クエリ（検索語なし等）をリセット
    fetchMock.mockClear();

    rerender({ q: "あ" });
    rerender({ q: "あい" });
    rerender({ q: "あいう" });
    // デバウンス待機中は新たな検索リクエストが発行されない
    expect(worksCallUrls(fetchMock)).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(250);
    });
    const urls = worksCallUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain(`/api/works?q=${encodeURIComponent("あいう")}`);
  });

  it("検索クリア（空文字）はデバウンスなしで即時リクエストされる", () => {
    const { rerender } = renderUseLibraryQueries("あいう");
    act(() => {
      vi.advanceTimersByTime(250);
    });
    fetchMock.mockClear();

    rerender({ q: "" });
    // タイマーを進めずとも即時発行される
    const urls = worksCallUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).not.toContain("q=");
  });

  it("queryFn の AbortSignal が fetch へ伝播される", () => {
    renderUseLibraryQueries("");
    const init = fetchMock.mock.calls.find(([input]) => urlOf(input).startsWith("/api/works"))?.[1];
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("古い検索リクエストの中断", () => {
  it("fetch 未完了のまま検索語が確定し直すと、前のリクエストの signal が abort される", async () => {
    vi.useFakeTimers();
    const capturedSignals: AbortSignal[] = [];
    const pendingMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = urlOf(input);
      if (url.startsWith("/api/works") && url.includes("q=")) {
        // 検索クエリだけ pending のままにして abort を観測する
        if (init?.signal) capturedSignals.push(init.signal);
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        });
      }
      if (url.startsWith("/api/works"))
        return Promise.resolve(jsonResponse({ items: [], total: 0 }));
      if (url.startsWith("/api/tag-prefixes")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/api/tags")) return Promise.resolve(jsonResponse([]));
      if (url.startsWith("/api/smart-folders")) return Promise.resolve(jsonResponse([]));
      return Promise.reject(new Error(`unexpected fetch: ${url}`));
    });
    vi.stubGlobal("fetch", pendingMock);

    try {
      const { rerender, unmount } = renderUseLibraryQueries("");

      // 「あ」で確定 → fetch 発行（pending のまま）
      rerender({ q: "あ" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(capturedSignals).toHaveLength(1);
      expect(capturedSignals[0]!.aborted).toBe(false);

      // 「あい」で確定し直す → 前のクエリは中断される
      rerender({ q: "あい" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });
      expect(capturedSignals).toHaveLength(2);
      expect(capturedSignals[0]!.aborted).toBe(true);
      expect(capturedSignals[1]!.aborted).toBe(false);

      unmount();
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
