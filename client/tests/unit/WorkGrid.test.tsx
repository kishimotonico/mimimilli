import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import WorkGrid from "../../src/features/library/ui/WorkGrid";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

function createWorks(count: number): WorkListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `work-${i}`,
    title: `作品 ${i}`,
    coverImage: null,
    status: "ok",
    totalDurationSec: 0,
    trackCount: 0,
    bookmarked: false,
    lastPlayedAt: null,
    circleName: null,
  }));
}

function renderWorkGrid(props: Partial<React.ComponentProps<typeof WorkGrid>> = {}) {
  return render(
    <Provider>
      <WorkGrid
        axis="all"
        drillValue={null}
        works={createWorks(100)}
        worksQueryKey="key-1"
        selectedWorkId={null}
        searchQuery=""
        tileSize={160}
        gridLayoutMode="square"
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onTileSizeChange={vi.fn()}
        onWorkSelect={vi.fn()}
        onWorkPlay={vi.fn()}
        onDrillBack={vi.fn()}
        onClearSearch={vi.fn()}
        inspector={null}
        onInspectorClose={vi.fn()}
        {...props}
      />
    </Provider>,
  );
}

describe("WorkGrid virtual scrolling", () => {
  let sizeMock: { restore: () => void };

  beforeEach(() => {
    sizeMock = mockElementSize(800, 600) as unknown as { restore: () => void };
  });

  afterEach(() => {
    sizeMock.restore();
    clearResizeObservers();
  });

  it("renders far fewer tiles than total works for 10,000 items", async () => {
    renderWorkGrid({ works: createWorks(10_000) });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(10_000);
    // containerWidth=800, tileSize=160 → columnCount≈5, rowHeight≈207, viewport≈600,
    // overscan=5 行で画面上下に最大でも 10 行程度 = 50 タイル前後が目安。
    expect(tiles.length).toBeLessThan(200);
  });

  it("renders far fewer tiles than total works for 1,000 items", async () => {
    renderWorkGrid({ works: createWorks(1_000) });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(1_000);
    expect(tiles.length).toBeLessThan(200);
  });

  it("moves focus to the next row with ArrowDown based on calculated column count", async () => {
    renderWorkGrid({ works: createWorks(100) });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択/ });
    tiles[0].focus();
    expect(document.activeElement).toBe(tiles[0]);

    await userEvent.keyboard("{ArrowDown}");

    // columnCount=5 なので 0→5
    await waitFor(() => {
      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.getAttribute("data-flat-index")).toBe("5");
    });
  });

  it("resets scroll position when worksQueryKey changes", async () => {
    const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
    const { rerender } = renderWorkGrid();
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const callsBefore = scrollToSpy.mock.calls.length;

    rerender(
      <Provider>
        <WorkGrid
          axis="all"
          drillValue={null}
          works={createWorks(100)}
          worksQueryKey="key-2"
          selectedWorkId={null}
          searchQuery=""
          tileSize={160}
          gridLayoutMode="square"
          isLoading={false}
          isError={false}
          hasNextPage={false}
          onTileSizeChange={vi.fn()}
          onWorkSelect={vi.fn()}
          onWorkPlay={vi.fn()}
          onDrillBack={vi.fn()}
          onClearSearch={vi.fn()}
          inspector={null}
          onInspectorClose={vi.fn()}
        />
      </Provider>,
    );

    expect(scrollToSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    scrollToSpy.mockRestore();
  });

  it("calls onLoadMore when scrolled near the end", async () => {
    const onLoadMore = vi.fn();
    const { container } = renderWorkGrid({
      works: createWorks(1_000),
      hasNextPage: true,
      onLoadMore,
    });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const scrollEl = container.querySelector(".mll-grid-scroll");
    if (!(scrollEl instanceof HTMLElement)) throw new Error("scroll element not found");

    // 末尾付近までスクロール
    await act(() => {
      scrollEl.scrollTop = 1_000_000;
      scrollEl.dispatchEvent(new Event("scroll"));
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it("preserves aria-label, aria-pressed, and button structure on tiles", async () => {
    renderWorkGrid({ works: createWorks(10) });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tile = screen.queryAllByRole("button", { name: /を選択/ })[0];
    expect(tile).toHaveAttribute("aria-label", "作品 0を選択");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(tile).toHaveAttribute("data-flat-index", "0");
  });

  it("renders far fewer tiles in justified mode", async () => {
    renderWorkGrid({ works: createWorks(1_000), gridLayoutMode: "justified" });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 800, height: 600 });
    });

    const tiles = screen.queryAllByRole("button", { name: /を選択/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(1_000);
    expect(tiles.length).toBeLessThan(200);
  });
});
