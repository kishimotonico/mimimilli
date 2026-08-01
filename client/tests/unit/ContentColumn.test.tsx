import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import ContentColumn from "../../src/features/library/ui/ContentColumn";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";

function createWorks(count: number): WorkListItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `work-${i}`,
    title: `作品 ${i}`,
    cover: null,
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
        works={createWorks(100)}
        worksQueryKey="key-1"
        facetItems={[]}
        tagPrefixes={[]}
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

  afterEach(async () => {
    // react-virtual の scroll debounce（isScrollingResetDelay=150ms）が
    // unmountしても生き残るため、jsdom環境が生きているうちに消化してから破棄する。
    // 消化前にunmountしないとタイマーが残り続けるため、cleanup()を先に呼ぶ。
    cleanup();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
    });
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
          works={createWorks(100)}
          worksQueryKey="key-2"
          facetItems={[]}
          tagPrefixes={[]}
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
          onTagToggle={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </Provider>,
    );

    expect(scrollToSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    scrollToSpy.mockRestore();
  });
});

describe("ContentColumn virtualizer isolation", () => {
  it("renders all tag rows without virtualizing", () => {
    const facetItems = Array.from({ length: 200 }, (_, i) => ({
      value: `tag-${i}`,
      count: i,
    }));
    const { container } = renderContentColumn({
      axis: "tag",
      facetItems,
      works: createWorks(10_000),
    });

    expect(container.querySelectorAll(".mll-tagrow").length).toBe(200);
  });

  it("renders all facet rows without virtualizing", () => {
    const facetItems = Array.from({ length: 200 }, (_, i) => ({
      value: `circle-${i}`,
      count: i,
    }));
    const { container } = renderContentColumn({
      axis: "circle",
      facetItems,
      works: createWorks(10_000),
    });

    expect(container.querySelectorAll(".mll-erow").length).toBe(200);
  });
});

describe("ContentColumn タグ軸のprefixグループ表示（ADR-0005 追記）", () => {
  it("prefix付きタグをprefixグループ見出し付きで表示し、フラットタグは「タグ」見出しにまとまる", () => {
    const { container } = renderContentColumn({
      axis: "tag",
      facetItems: [
        { value: "ASMR", count: 5 },
        { value: "cv/藤田茜", count: 3 },
        { value: "サークル/夜想曲", count: 2 },
      ],
      tagPrefixes: [
        { prefix: "cv", label: "CV", color: "cv", showAsAxis: true, protected: true },
        {
          prefix: "サークル",
          label: "サークル",
          color: "circle",
          showAsAxis: true,
          protected: true,
        },
      ],
    });

    const headings = Array.from(container.querySelectorAll(".mll-taggroup .mll-axisgroup__hd")).map(
      (el) => el.textContent,
    );
    expect(headings).toEqual(["タグ", "CV", "サークル"]);

    const rows = container.querySelectorAll(".mll-tagrow .nm");
    expect(Array.from(rows).map((el) => el.textContent)).toEqual(["ASMR", "藤田茜", "夜想曲"]);
  });

  it("見出しの件数はグループ化前の全タグ件数を表示する", () => {
    const { container } = renderContentColumn({
      axis: "tag",
      facetItems: [
        { value: "ASMR", count: 5 },
        { value: "cv/藤田茜", count: 3 },
      ],
    });
    const hd = container.querySelector(".mle-col__hd .count");
    expect(hd?.textContent).toBe("2 件");
  });
});

describe("ContentColumn list scroll reset", () => {
  const facetItems = Array.from({ length: 50 }, (_, i) => ({
    value: `item-${i}`,
    count: i,
  }));

  it("resets tag axis scroll position when worksQueryKey changes", () => {
    const { container, rerender } = renderContentColumn({
      axis: "tag",
      facetItems,
    });
    const listEl = container.querySelector(".mle-col__list");
    if (!(listEl instanceof HTMLElement)) throw new Error("list element not found");

    listEl.scrollTop = 500;
    expect(listEl.scrollTop).toBe(500);

    rerender(
      <Provider>
        <ContentColumn
          axis="tag"
          works={createWorks(100)}
          worksQueryKey="key-2"
          facetItems={facetItems}
          tagPrefixes={[]}
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
          onTagToggle={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </Provider>,
    );

    expect(listEl.scrollTop).toBe(0);
  });

  it("resets facet axis scroll position when worksQueryKey changes", () => {
    const { container, rerender } = renderContentColumn({
      axis: "circle",
      facetItems,
    });
    const listEl = container.querySelector(".mle-col__list");
    if (!(listEl instanceof HTMLElement)) throw new Error("list element not found");

    listEl.scrollTop = 500;
    expect(listEl.scrollTop).toBe(500);

    rerender(
      <Provider>
        <ContentColumn
          axis="circle"
          works={createWorks(100)}
          worksQueryKey="key-2"
          facetItems={facetItems}
          tagPrefixes={[]}
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
          onTagToggle={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </Provider>,
    );

    expect(listEl.scrollTop).toBe(0);
  });
});

describe("ContentColumn tag axis accessibility", () => {
  it("exposes tag selection state with aria-pressed", () => {
    const { container } = renderContentColumn({
      axis: "tag",
      facetItems: [
        { value: "tag-a", count: 1 },
        { value: "tag-b", count: 2 },
      ],
      selectedTags: ["tag-a"],
    });

    const tagRows = container.querySelectorAll(".mll-tagrow");
    expect(tagRows[0]).toHaveAttribute("aria-pressed", "true");
    expect(tagRows[1]).toHaveAttribute("aria-pressed", "false");
  });

  it("gives selected tag remove buttons an accessible name", () => {
    renderContentColumn({
      axis: "tag",
      facetItems: [{ value: "tag-a", count: 1 }],
      selectedTags: ["tag-a"],
    });

    expect(screen.getByRole("button", { name: "tag-aを解除" })).toBeInTheDocument();
  });
});

describe("ContentColumn エラー・空状態の再試行導線", () => {
  it("作品一覧の isError で再試行ボタンをクリックすると onRetryWorks を呼ぶ", async () => {
    const onRetryWorks = vi.fn();
    const user = userEvent.setup();
    renderContentColumn({ axis: "all", isError: true, onRetryWorks });

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetryWorks).toHaveBeenCalledTimes(1);
  });

  it("タグ軸の isFacetError で再試行ボタンをクリックすると onRetryFacets を呼ぶ", async () => {
    const onRetryFacets = vi.fn();
    const user = userEvent.setup();
    renderContentColumn({ axis: "tag", isFacetError: true, onRetryFacets });

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetryFacets).toHaveBeenCalledTimes(1);
  });

  it("ファセット軸の isFacetError で再試行ボタンをクリックすると onRetryFacets を呼ぶ", async () => {
    const onRetryFacets = vi.fn();
    const user = userEvent.setup();
    renderContentColumn({ axis: "circle", isFacetError: true, onRetryFacets });

    await user.click(screen.getByRole("button", { name: "再試行" }));
    expect(onRetryFacets).toHaveBeenCalledTimes(1);
  });

  it("タグ軸: facetItemsのキャッシュがあるisFacetErrorは一覧をブロックせず非ブロッキングのエラー行を出す", () => {
    renderContentColumn({
      axis: "tag",
      isFacetError: true,
      facetItems: [{ value: "tag-a", count: 3 }],
    });

    // 一覧全体を差し替える CollectionStatus(kind="error") ではなく、非ブロッキングの
    // エラー行が出て、キャッシュ済みのタグ行はそのまま表示され続ける。
    expect(screen.getByText("タグの取得に失敗しました")).toBeTruthy();
    expect(screen.getByText("tag-a")).toBeTruthy();
  });

  it("ファセット軸: facetItemsのキャッシュがあるisFacetErrorは一覧をブロックせず非ブロッキングのエラー行を出す", () => {
    renderContentColumn({
      axis: "circle",
      isFacetError: true,
      facetItems: [{ value: "circle-a", count: 2 }],
    });

    // tagPrefixes未登録時のgetAxisLabelはaxis idをそのまま返す（getAxisLabelの既存仕様）
    expect(screen.getByText("circleの取得に失敗しました")).toBeTruthy();
    expect(screen.getByText("circle-a")).toBeTruthy();
  });

  it("キャッシュが無い（facetItems空）isFacetErrorは従来どおり一覧全体をエラー画面に置き換える", () => {
    renderContentColumn({ axis: "circle", isFacetError: true, facetItems: [] });

    expect(screen.getByText("読み込みに失敗しました")).toBeTruthy();
    expect(screen.queryByText("circleの取得に失敗しました")).toBeNull();
  });

  it("お気に入りビューが0件のとき文脈付きの案内を1行添える", () => {
    renderContentColumn({ axis: "fav", works: [] });
    expect(screen.getByText("作品詳細の☆ボタンでお気に入りに追加できます")).toBeTruthy();
  });
});
