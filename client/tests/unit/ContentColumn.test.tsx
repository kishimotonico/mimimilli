import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { Provider } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import ContentColumn from "../../src/features/library/ui/ContentColumn";
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

function renderContentColumn(props: Partial<React.ComponentProps<typeof ContentColumn>> = {}) {
  return render(
    <Provider>
      <ContentColumn
        axis="all"
        drillValue={null}
        works={createWorks(100)}
        worksQueryKey="key-1"
        facetItems={[]}
        selectedWorkId={null}
        selectedTags={[]}
        searchQuery=""
        playingWorkId={undefined}
        isPlaybackActive={false}
        isLoading={false}
        isError={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        onWorkSelect={vi.fn()}
        onDrillSelect={vi.fn()}
        onDrillBack={vi.fn()}
        onTagToggle={vi.fn()}
        onClearSearch={vi.fn()}
        {...props}
      />
    </Provider>,
  );
}

describe("ContentColumn virtual scrolling", () => {
  let sizeMock: { restore: () => void };

  beforeEach(() => {
    sizeMock = mockElementSize(300, 600) as unknown as { restore: () => void };
  });

  afterEach(() => {
    sizeMock.restore();
    clearResizeObservers();
  });

  it("renders far fewer rows than total works for 10,000 items", async () => {
    renderContentColumn({ works: createWorks(10_000) });
    await act(async () => {
      // useVirtualizer の effect で observer が observe するまで待つ
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const rows = screen.queryAllByRole("button", { name: /作品 \d/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(10_000);
    // viewport≈600, row≈42, overscan=5 → 上下 10 行 + 中央 14 行 = 24 行前後
    expect(rows.length).toBeLessThan(100);
  });

  it("renders far fewer rows than total works for 1,000 items", async () => {
    renderContentColumn({ works: createWorks(1_000) });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const rows = screen.queryAllByRole("button", { name: /作品 \d/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(1_000);
    expect(rows.length).toBeLessThan(100);
  });

  it("calls onLoadMore when scrolled near the end", async () => {
    const onLoadMore = vi.fn();
    const { container } = renderContentColumn({
      works: createWorks(1_000),
      hasNextPage: true,
      onLoadMore,
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const listEl = container.querySelector(".mle-col__list");
    if (!(listEl instanceof HTMLElement)) throw new Error("list element not found");

    await act(() => {
      listEl.scrollTop = 1_000_000;
      listEl.dispatchEvent(new Event("scroll"));
    });

    expect(onLoadMore).toHaveBeenCalled();
  });

  it("resets scroll position when worksQueryKey changes", async () => {
    const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
    const { rerender } = renderContentColumn();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const callsBefore = scrollToSpy.mock.calls.length;

    rerender(
      <Provider>
        <ContentColumn
          axis="all"
          drillValue={null}
          works={createWorks(100)}
          worksQueryKey="key-2"
          facetItems={[]}
          selectedWorkId={null}
          selectedTags={[]}
          searchQuery=""
          playingWorkId={undefined}
          isPlaybackActive={false}
          isLoading={false}
          isError={false}
          hasNextPage={false}
          onLoadMore={vi.fn()}
          onWorkSelect={vi.fn()}
          onDrillSelect={vi.fn()}
          onDrillBack={vi.fn()}
          onTagToggle={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </Provider>,
    );

    expect(scrollToSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    scrollToSpy.mockRestore();
  });
});
