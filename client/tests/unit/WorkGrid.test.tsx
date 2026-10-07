import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider, createStore } from "jotai";
import type { WorkListItem } from "@mimimilli/shared";
import WorkGrid from "../../src/features/library/ui/WorkGrid";
import type { WorkResultsProps } from "../../src/features/library/ui/workResultsProps";
import {
  libraryGridLayoutModeAtom,
  libraryTileSizeAtom,
} from "../../src/features/library/model/atoms";
import type { GridLayoutMode } from "../../src/entities/library/types";
import type {
  LibraryViewActions,
  LibraryViewState,
} from "../../src/features/library/model/useLibraryNavigation";
import { buildNav } from "./fixtures/libraryNav";
import { setPlayingWork } from "./fixtures/playerCore";
import { clearResizeObservers, flushAllResizeObservers, mockElementSize } from "./setup";
import { nts } from "../helpers/tag";

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

interface WorkGridTestOverrides {
  nav?: Partial<LibraryViewState & LibraryViewActions>;
  works?: WorkListItem[];
  worksQueryKey?: string;
  isPending?: boolean;
  dockedBarActive?: boolean;
  onWorkPlay?: WorkResultsProps["onWorkPlay"];
  pagination?: Partial<WorkResultsProps["pagination"]>;
  emptyState?: Partial<WorkResultsProps["emptyState"]>;
}

function buildProps(overrides: WorkGridTestOverrides): WorkResultsProps {
  return {
    nav: buildNav(overrides.nav),
    works: overrides.works ?? createWorks(100),
    worksQueryKey: overrides.worksQueryKey ?? "key-1",
    isPending: overrides.isPending,
    dockedBarActive: overrides.dockedBarActive,
    onWorkPlay: overrides.onWorkPlay ?? vi.fn(),
    pagination: { hasNextPage: false, ...overrides.pagination },
    emptyState: { searchQuery: "", onClearSearch: vi.fn(), ...overrides.emptyState },
  };
}

interface RenderWorkGridOptions {
  overrides?: WorkGridTestOverrides;
  tileSize?: number;
  gridLayoutMode?: GridLayoutMode;
}

function renderWorkGrid({
  overrides = {},
  tileSize = 160,
  gridLayoutMode = "square",
}: RenderWorkGridOptions = {}) {
  const store = createStore();
  store.set(libraryTileSizeAtom, tileSize);
  store.set(libraryGridLayoutModeAtom, gridLayoutMode);

  const result = render(
    <Provider store={store}>
      <WorkGrid {...buildProps(overrides)} />
    </Provider>,
  );

  return {
    ...result,
    store,
    // 同じ store を保ったまま props だけ差し替える（atom の値をリセットしない）
    rerenderWorkGrid: (nextOverrides: WorkGridTestOverrides) =>
      result.rerender(
        <Provider store={store}>
          <WorkGrid {...buildProps(nextOverrides)} />
        </Provider>,
      ),
  };
}

describe("WorkGrid virtual scrolling", () => {
  let sizeMock: { restore: () => void };

  beforeEach(() => {
    sizeMock = mockElementSize(800, 600) as unknown as { restore: () => void };
  });

  afterEach(() => {
    cleanup();
    sizeMock.restore();
    clearResizeObservers();
  });

  it("マウント直後（ResizeObserver発火前）でも layout effect の同期測定で列数が確定する", () => {
    // ResizeObserver のコールバックをまだ一度も flush していない状態で列数（columnCount）を検証する。
    // containerWidth が 0 のままだと columnCount=1 に落ちて空白同然のレイアウトになるため、
    // useLayoutEffect による getBoundingClientRect() 同期測定で正しい列数が出ることを確認する。
    const { container } = renderWorkGrid({ overrides: { works: createWorks(100) } });

    const row = container.querySelector(".mll-grid-row--square");
    expect(row).not.toBeNull();
    // containerWidth=800, tileSize=160 → columnCount≈5
    expect((row as HTMLElement).style.gridTemplateColumns).toBe("repeat(5, 1fr)");
  });

  it("renders far fewer tiles than total works for 1,000 items", async () => {
    renderWorkGrid({ overrides: { works: createWorks(1_000) } });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(1_000);
    // containerWidth=800, tileSize=160 → columnCount≈5, rowHeight≈207, viewport≈600,
    // overscan=5 行で画面上下に最大でも 10 行程度 = 50 タイル前後が目安。
    expect(tiles.length).toBeLessThan(200);
  });

  it("moves focus to the next row with ArrowDown based on calculated column count", async () => {
    renderWorkGrid({ overrides: { works: createWorks(100) } });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ });
    tiles[0].focus();
    expect(document.activeElement).toBe(tiles[0]);

    await userEvent.keyboard("{ArrowDown}");

    // columnCount=5 なので 0→5
    await waitFor(() => {
      const focused = document.activeElement as HTMLElement | null;
      expect(focused?.getAttribute("data-flat-index")).toBe("5");
    });
  });

  it("矢印キーでのフォーカス移動は選択も追従させる", async () => {
    const selectWork = vi.fn();
    renderWorkGrid({ overrides: { works: createWorks(100), nav: { selectWork } } });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ });
    tiles[0].focus();

    await userEvent.keyboard("{ArrowDown}");

    await waitFor(() => {
      expect(selectWork).toHaveBeenCalledWith("work-5");
    });
  });

  it("Enterでフォーカス項目を再生する", async () => {
    const onWorkPlay = vi.fn();
    renderWorkGrid({ overrides: { works: createWorks(10), onWorkPlay } });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tiles = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ });
    tiles[2].focus();

    await userEvent.keyboard("{Enter}");

    expect(onWorkPlay).toHaveBeenCalledWith(expect.objectContaining({ id: "work-2" }));
  });

  it("再生中の作品タイルに再生インジケーターを表示する", async () => {
    const store = createStore();
    store.set(libraryTileSizeAtom, 160);
    store.set(libraryGridLayoutModeAtom, "square");
    setPlayingWork(store, "work-3", { isPlaying: true });
    render(
      <Provider store={store}>
        <WorkGrid {...buildProps({ works: createWorks(10) })} />
      </Provider>,
    );
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    expect(screen.getByLabelText("再生中")).toBeInTheDocument();
  });

  it("一時停止中は再生インジケーターのアクセシブル名が切り替わる", async () => {
    const store = createStore();
    store.set(libraryTileSizeAtom, 160);
    store.set(libraryGridLayoutModeAtom, "square");
    setPlayingWork(store, "work-3", { isPlaying: false });
    render(
      <Provider store={store}>
        <WorkGrid {...buildProps({ works: createWorks(10) })} />
      </Provider>,
    );
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    expect(screen.getByLabelText("一時停止中")).toBeInTheDocument();
  });

  it("resets scroll position when worksQueryKey changes", async () => {
    const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
    const { rerenderWorkGrid } = renderWorkGrid();
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const callsBefore = scrollToSpy.mock.calls.length;

    rerenderWorkGrid({ worksQueryKey: "key-2" });

    expect(scrollToSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    scrollToSpy.mockRestore();
  });

  describe("スクロールのきっかけ", () => {
    afterEach(() => vi.restoreAllMocks());

    it("mount時に選択がある場合、選択作品の行位置へスクロールする", async () => {
      // happy-domはscrollHeightを再現せず、virtualizerがスクロール先を0へ丸めてしまうため固定する
      vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(1_000_000);
      const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
      renderWorkGrid({
        overrides: { works: createWorks(1_000), nav: { selectedWorkId: "work-500" } },
      });
      await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

      const tops = scrollToSpy.mock.calls.map(([arg]) => (arg as ScrollToOptions).top ?? 0);
      // work-500は5列グリッドの行100付近。先頭(0)や手前の行ではなく、その行の位置まで進む
      expect(Math.max(...tops)).toBeGreaterThan(10_000);
      expect(Math.max(...tops)).toBeLessThan(25_000);
    });

    it("選択を解除してもスクロールしない", async () => {
      const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
      const works = createWorks(1_000);
      const { rerenderWorkGrid } = renderWorkGrid({
        overrides: { works, nav: { selectedWorkId: "work-500" } },
      });
      await act(() => flushAllResizeObservers({ width: 800, height: 600 }));
      scrollToSpy.mockClear();

      rerenderWorkGrid({ works, nav: { selectedWorkId: null } });
      await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("列数が変わってもスクロールしない", async () => {
      const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
      const { container } = renderWorkGrid({
        overrides: { works: createWorks(1_000), nav: { selectedWorkId: "work-500" } },
      });
      await act(() => flushAllResizeObservers({ width: 800, height: 600 }));
      const columnsBefore =
        container.querySelector<HTMLElement>(".mll-grid-row--square")?.style.gridTemplateColumns;
      scrollToSpy.mockClear();

      await act(() => flushAllResizeObservers({ width: 480, height: 600 }));

      expect(
        container.querySelector<HTMLElement>(".mll-grid-row--square")?.style.gridTemplateColumns,
      ).not.toBe(columnsBefore);

      expect(scrollToSpy).not.toHaveBeenCalled();
    });

    it("worksQueryKeyが変わったとき、選択作品が無ければ先頭へスクロールする", async () => {
      const scrollToSpy = vi.spyOn(Element.prototype, "scrollTo").mockImplementation(() => {});
      const { rerenderWorkGrid } = renderWorkGrid();
      await act(() => flushAllResizeObservers({ width: 800, height: 600 }));
      scrollToSpy.mockClear();

      rerenderWorkGrid({ worksQueryKey: "key-2" });

      expect(scrollToSpy).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });
  });

  it("calls onLoadMore when scrolled near the end", async () => {
    const onLoadMore = vi.fn();
    const { container } = renderWorkGrid({
      overrides: {
        works: createWorks(1_000),
        pagination: { hasNextPage: true, onLoadMore },
      },
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
    renderWorkGrid({ overrides: { works: createWorks(10) } });
    await act(() => flushAllResizeObservers({ width: 800, height: 600 }));

    const tile = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ })[0];
    expect(tile).toHaveAttribute("aria-label", "作品 0を選択、Enterで再生");
    expect(tile).toHaveAttribute("aria-pressed", "false");
    expect(tile).toHaveAttribute("data-flat-index", "0");
  });

  it("renders far fewer tiles in justified mode", async () => {
    renderWorkGrid({
      overrides: { works: createWorks(1_000) },
      gridLayoutMode: "justified",
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 800, height: 600 });
    });

    const tiles = screen.queryAllByRole("button", { name: /を選択、Enterで再生/ });
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(1_000);
    expect(tiles.length).toBeLessThan(200);
  });
});

describe("WorkGrid empty states", () => {
  afterEach(() => {
    cleanup();
    clearResizeObservers();
  });

  it("お気に入りビューが0件のとき文脈付きの案内を1行添える", () => {
    renderWorkGrid({ overrides: { nav: { activeAxis: "fav" }, works: [] } });
    expect(screen.getByText("作品詳細の☆ボタンでお気に入りに追加できます")).toBeTruthy();
  });

  it("スマートフォルダーが0件のとき専用の見出しと「条件を編集」を出す", () => {
    const onEditSmartFolderRules = vi.fn();
    renderWorkGrid({
      overrides: { works: [], emptyState: { isSmartFolder: true, onEditSmartFolderRules } },
    });

    expect(screen.getByText("条件に一致する作品がありません")).toBeTruthy();
    expect(screen.getByText("条件を見直すか、絞り込みを外してください。")).toBeTruthy();
    expect(screen.queryByText("絞り込みをすべてクリア")).toBeNull();

    screen.getByRole("button", { name: "条件を編集" }).click();
    expect(onEditSmartFolderRules).toHaveBeenCalled();
  });

  it("スマートフォルダーが0件・チップ絞り込み中のとき「絞り込みをすべてクリア」も出す", () => {
    const clearTags = vi.fn();
    renderWorkGrid({
      overrides: {
        works: [],
        nav: { selectedTags: nts(["タグ"]), clearTags },
        emptyState: { isSmartFolder: true },
      },
    });

    screen.getByRole("button", { name: "絞り込みをすべてクリア" }).click();
    expect(clearTags).toHaveBeenCalled();
  });
});
