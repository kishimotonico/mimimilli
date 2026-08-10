import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { useLibraryNavigation } from "../../src/features/library/model/useLibraryNavigation";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import LibraryWorksBoundary from "../../src/features/library/ui/LibraryWorksBoundary";

const baseNav: LibraryViewState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
};

function response(items: { id: string; title: string }[]) {
  return new Response(
    JSON.stringify({
      items: items.map((item) => ({
        ...item,
        cover: null,
        status: "ok",
        totalDurationSec: null,
        trackCount: 0,
        bookmarked: false,
        lastPlayedAt: null,
        circleName: null,
      })),
      total: items.length,
      stats: { trackCount: 0, durationSec: 0 },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function renderBoundary(children: Parameters<typeof LibraryWorksBoundary>[0]["children"]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LibraryWorksBoundary
        nav={baseNav}
        searchQuery=""
        viewMode="list"
        isPending={false}
        onNoResultsChange={() => undefined}
      >
        {children}
      </LibraryWorksBoundary>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("LibraryWorksBoundary", () => {
  it("初回取得中だけ既存の読み込みfallbackを表示する", async () => {
    let resolveFetch: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );

    renderBoundary((result) => <div>{result.works[0]?.title}</div>);

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中...");
    await act(async () => resolveFetch?.(response([{ id: "old", title: "旧作品" }])));
    expect(await screen.findByText("旧作品")).toBeInTheDocument();
  });

  it("並び替えactionのtransition中は旧一覧を薄表示で保持し、解決後に解除する", async () => {
    let resolveRandom: ((value: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = new URL(
          typeof input === "string" ? input : input.toString(),
          "http://localhost",
        );
        if (url.searchParams.get("sort") === "random") {
          return new Promise<Response>((resolve) => {
            resolveRandom = resolve;
          });
        }
        return Promise.resolve(response([{ id: "old", title: "旧作品" }]));
      }),
    );

    function SortControl() {
      const { setSort } = useLibraryNavigation();
      return (
        <button type="button" onClick={() => setSort("random")}>
          ランダム順へ
        </button>
      );
    }

    function Results() {
      const nav = useLibraryNavigation();
      return (
        <LibraryWorksBoundary
          nav={nav}
          searchQuery=""
          viewMode="list"
          isPending={nav.isPending}
          onNoResultsChange={() => undefined}
        >
          {(result, isPending) => (
            <div className={isPending ? "is-pending" : ""}>{result.works[0]?.title}</div>
          )}
        </LibraryWorksBoundary>
      );
    }

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const store = createStore();
    render(
      <QueryClientProvider client={queryClient}>
        <JotaiProvider store={store}>
          <LibraryNavigationProvider>
            <SortControl />
            <Results />
          </LibraryNavigationProvider>
        </JotaiProvider>
      </QueryClientProvider>,
    );

    expect(await screen.findByText("旧作品")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ランダム順へ" }));

    expect(screen.getByText("旧作品")).toBeInTheDocument();
    expect(screen.queryByText("読み込み中...")).not.toBeInTheDocument();
    expect(screen.getByText("旧作品")).toHaveClass("is-pending");

    await act(async () => resolveRandom?.(response([{ id: "new", title: "新作品" }])));
    await waitFor(() => expect(screen.getByText("新作品")).toBeInTheDocument());
    expect(screen.getByText("新作品")).not.toHaveClass("is-pending");
  });
});
