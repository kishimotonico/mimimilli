import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Provider as JotaiProvider, createStore } from "jotai";
import { describe, expect, it } from "vitest";
import type { LibraryViewState } from "../../src/features/library/model/useLibraryNavigation";
import { useLibraryNavigation } from "../../src/features/library/model/useLibraryNavigation";
import { LibraryNavigationProvider } from "../../src/features/library/ui/LibraryNavigationProvider";
import { mockApi } from "../helpers/api";
import { buildWorkListItem, buildWorksPage } from "../helpers/builders";
import LibraryWorksBoundary from "../../src/features/library/ui/LibraryWorksBoundary";

const baseNav: LibraryViewState = {
  activeAxis: "all",
  selectedTags: [],
  selectedWorkId: null,
  sort: "added-desc",
};

function worksPage(items: { id: string; title: string }[]) {
  return buildWorksPage(items.map((item) => buildWorkListItem(item)));
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
        onWorksTotalChange={() => undefined}
      >
        {children}
      </LibraryWorksBoundary>
    </QueryClientProvider>,
  );
}

describe("LibraryWorksBoundary", () => {
  it("初回取得中だけ既存の読み込みfallbackを表示する", async () => {
    let resolveFetch: ((value: unknown) => void) | undefined;
    mockApi({
      "GET /api/works": () =>
        new Promise<unknown>((resolve) => {
          resolveFetch = resolve;
        }),
    });

    renderBoundary((result) => <div>{result.works[0]?.title}</div>);

    expect(screen.getByRole("status")).toHaveTextContent("読み込み中...");
    await act(async () => resolveFetch?.(worksPage([{ id: "old", title: "旧作品" }])));
    expect(await screen.findByText("旧作品")).toBeInTheDocument();
  });

  it("並び替えactionのtransition中は旧一覧を薄表示で保持し、解決後に解除する", async () => {
    let resolveRandom: ((value: unknown) => void) | undefined;
    mockApi({
      "GET /api/works": ({ url }) => {
        if (url.searchParams.get("sort") === "random") {
          return new Promise<unknown>((resolve) => {
            resolveRandom = resolve;
          });
        }
        return worksPage([{ id: "old", title: "旧作品" }]);
      },
    });

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
          onWorksTotalChange={() => undefined}
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

    await act(async () => resolveRandom?.(worksPage([{ id: "new", title: "新作品" }])));
    await waitFor(() => expect(screen.getByText("新作品")).toBeInTheDocument());
    expect(screen.getByText("新作品")).not.toHaveClass("is-pending");
  });
});
