import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { Provider as JotaiProvider, createStore } from "jotai";
import userEvent from "@testing-library/user-event";
import type { WorkListItem } from "@mimimilli/shared";
import WorkListPane from "../../src/features/library/ui/WorkListPane";
import {
  PLAYER_CORE_INITIAL,
  playerCoreAtom,
  playerUiModeAtom,
} from "../../src/entities/player/model/atoms";
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

function renderWorkListPane(
  props: Partial<React.ComponentProps<typeof WorkListPane>> = {},
  options?: { dockedBarActive?: boolean },
) {
  const store = createStore();
  if (options?.dockedBarActive) {
    store.set(playerCoreAtom, {
      ...PLAYER_CORE_INITIAL,
      currentTrackIndex: 0,
      currentWork: createWorks(1)[0],
    });
    store.set(playerUiModeAtom, "bar");
  }

  return render(
    <JotaiProvider store={store}>
      <WorkListPane
        axis="all"
        works={createWorks(100)}
        worksQueryKey="key-1"
        selectedWorkId={null}
        searchQuery=""
        hasSelectedTags={false}
        playingWorkId={undefined}
        isPlaybackActive={false}
        hasNextPage={false}
        onLoadMore={vi.fn()}
        onWorkSelect={vi.fn()}
        onClearSearch={vi.fn()}
        {...props}
      />
    </JotaiProvider>,
  );
}

describe("WorkListPane virtual scrolling", () => {
  let sizeMock: { restore: () => void };

  beforeEach(() => {
    sizeMock = mockElementSize(300, 600) as unknown as { restore: () => void };
  });

  afterEach(() => {
    cleanup();
    sizeMock.restore();
    clearResizeObservers();
  });

  it("renders far fewer rows than total works for 10,000 items", async () => {
    renderWorkListPane({ works: createWorks(10_000) });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const rows = screen.queryAllByRole("button", { name: /作品 \d/ });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(10_000);
    expect(rows.length).toBeLessThan(100);
  });

  it("calls onLoadMore when scrolled near the end", async () => {
    const onLoadMore = vi.fn();
    const { container } = renderWorkListPane({
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
    const store = createStore();
    const { rerender } = render(
      <JotaiProvider store={store}>
        <WorkListPane
          axis="all"
          works={createWorks(100)}
          worksQueryKey="key-1"
          selectedWorkId={null}
          searchQuery=""
          hasSelectedTags={false}
          hasNextPage={false}
          onLoadMore={vi.fn()}
          onWorkSelect={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </JotaiProvider>,
    );
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const callsBefore = scrollToSpy.mock.calls.length;

    rerender(
      <JotaiProvider store={store}>
        <WorkListPane
          axis="all"
          works={createWorks(100)}
          worksQueryKey="key-2"
          selectedWorkId={null}
          searchQuery=""
          hasSelectedTags={false}
          hasNextPage={false}
          onLoadMore={vi.fn()}
          onWorkSelect={vi.fn()}
          onClearSearch={vi.fn()}
        />
      </JotaiProvider>,
    );

    expect(scrollToSpy.mock.calls.length).toBeGreaterThan(callsBefore);
    scrollToSpy.mockRestore();
  });
});

describe("WorkListPane 空状態", () => {
  afterEach(() => {
    cleanup();
    clearResizeObservers();
  });

  it("お気に入りビューが0件のとき文脈付きの案内を1行添える", () => {
    renderWorkListPane({ axis: "fav", works: [] });
    expect(screen.getByText("作品詳細の☆ボタンでお気に入りに追加できます")).toBeTruthy();
  });

  it("選択中フィルタが原因の0件では専用メッセージを出す", () => {
    renderWorkListPane({ axis: "all", works: [], hasSelectedTags: true });
    expect(screen.getByText("選択中のフィルタに一致する作品はありません")).toBeTruthy();
  });

  it("検索語が原因の0件で検索クリアボタンを出す", async () => {
    const onClearSearch = vi.fn();
    const user = userEvent.setup();
    renderWorkListPane({ works: [], searchQuery: "ASMR", onClearSearch });

    await user.click(screen.getByRole("button", { name: "検索をクリア" }));
    expect(onClearSearch).toHaveBeenCalledTimes(1);
  });
});

describe("WorkListPane の末尾余白（docked bar）", () => {
  let sizeMock: { restore: () => void };

  beforeEach(() => {
    sizeMock = mockElementSize(300, 600) as unknown as { restore: () => void };
  });

  afterEach(() => {
    cleanup();
    sizeMock.restore();
    clearResizeObservers();
  });

  it("docked bar 表示時は virtualizer の paddingEnd が 12px になる", async () => {
    const works = createWorks(1);
    const { container: withoutDocked } = renderWorkListPane({ works });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });
    const wrapperWithout = withoutDocked.querySelector(".mle-col__list > div");
    if (!(wrapperWithout instanceof HTMLElement)) throw new Error("wrapper not found");
    const heightWithout = Number.parseFloat(wrapperWithout.style.height);

    const { container: withDocked } = renderWorkListPane({ works }, { dockedBarActive: true });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });
    const wrapperWith = withDocked.querySelector(".mle-col__list > div");
    if (!(wrapperWith instanceof HTMLElement)) throw new Error("wrapper not found");
    const heightWith = Number.parseFloat(wrapperWith.style.height);

    // happy-dom は flex スクロールの scrollHeight を再現しないため、paddingEnd の差は
    // 仮想化ラッパーの style.height（= getTotalSize）で検証する。
    expect(heightWith - heightWithout).toBe(8);
  });

  it("仮想化ラッパーに flexShrink:0 が付与される", async () => {
    const { container } = renderWorkListPane({ works: createWorks(5) });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
      flushAllResizeObservers({ width: 300, height: 600 });
    });

    const wrapper = container.querySelector(".mle-col__list > div");
    if (!(wrapper instanceof HTMLElement)) throw new Error("virtualized wrapper not found");
    expect(wrapper.style.flexShrink).toBe("0");
    expect(Number.parseFloat(wrapper.style.height)).toBeGreaterThan(0);
  });
});
