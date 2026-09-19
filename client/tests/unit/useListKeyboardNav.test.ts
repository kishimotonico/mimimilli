import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { useListKeyboardNav } from "../../src/shared/ui/useListKeyboardNav";
import * as gridNavigation from "../../src/shared/lib/gridNavigation";

vi.mock("../../src/shared/lib/gridNavigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/shared/lib/gridNavigation")>();
  return { ...actual, rowIndexOfFlatIndex: vi.fn(actual.rowIndexOfFlatIndex) };
});

interface Item {
  id: string;
}

function makeItem(id: string): Item {
  return { id };
}

describe("useListKeyboardNav（グリッド・仮想化）", () => {
  it("rowIndexOfFlatIndexが解決できたときはフォーカス移動とscrollToIndexを行う", () => {
    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const containerEl = document.createElement("div");
    const item0 = makeItem("w0");
    const item1 = makeItem("w1");

    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl,
        columnCount: 3,
        items: [item0, item1],
        onFocusItem,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    result.current(0, "ArrowRight");

    expect(onFocusItem).toHaveBeenCalledWith(item1, 1);
    expect(scrollToIndex).toHaveBeenCalled();
  });

  // rowIndexOfFlatIndexがundefinedを返す（ジャスティファイドで対応するタイルが無い）とき、
  // 行0として扱わず、scrollToIndexも呼ばない。
  it("rowIndexOfFlatIndexがundefinedのときはフォーカス移動もscrollToIndexも行わない", () => {
    (gridNavigation.rowIndexOfFlatIndex as Mock).mockReturnValueOnce(undefined);

    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const containerEl = document.createElement("div");
    const item0 = makeItem("w0");
    const item1 = makeItem("w1");

    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl,
        justifiedTiles: [
          { rowIndex: 0, centerX: 0 },
          { rowIndex: 0, centerX: 10 },
        ],
        columnCount: 3,
        items: [item0, item1],
        onFocusItem,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    result.current(0, "ArrowRight");

    expect(onFocusItem).not.toHaveBeenCalled();
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("端でのクランプ（次インデックスが現在位置のまま）ではフォーカス移動もscrollToIndexも行わない", () => {
    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const containerEl = document.createElement("div");

    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl,
        columnCount: 3,
        items: [makeItem("w0"), makeItem("w1")],
        onFocusItem,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    result.current(0, "ArrowLeft");

    expect(onFocusItem).not.toHaveBeenCalled();
    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it("justifiedTilesがあるときは行内中心x座標が最も近いタイルへ移動する", () => {
    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const containerEl = document.createElement("div");
    const items = [makeItem("t0"), makeItem("t1"), makeItem("t2")];

    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl,
        justifiedTiles: [
          { rowIndex: 0, centerX: 30 },
          { rowIndex: 1, centerX: 20 },
          { rowIndex: 1, centerX: 48 },
        ],
        columnCount: 3,
        items,
        onFocusItem,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    // index0 (centerX 30) の下は行1のうち近い方（|30-20|=10 < |30-48|=18）→ index1
    result.current(0, "ArrowDown");

    expect(onFocusItem).toHaveBeenCalledWith(items[1], 1);
    expect(scrollToIndex).toHaveBeenCalledWith(1, { align: "auto" });
  });
});

describe("useListKeyboardNav（非仮想化の一覧）", () => {
  it("virtualizerを省略すると即時フォーカスし、scrollToIndexは呼ばない", () => {
    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const containerEl = document.createElement("div");
    const row0 = document.createElement("button");
    row0.dataset.flatIndex = "0";
    const row1 = document.createElement("button");
    row1.dataset.flatIndex = "1";
    containerEl.append(row0, row1);
    document.body.append(containerEl);

    const focusSpy = vi.spyOn(row1, "focus");
    const scrollIntoViewSpy = vi.spyOn(row1, "scrollIntoView").mockImplementation(() => {});

    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl,
        columnCount: 1,
        items: [makeItem("e0"), makeItem("e1")],
        onFocusItem,
      }),
    );

    result.current(0, "ArrowDown");

    expect(onFocusItem).toHaveBeenCalledWith(makeItem("e1"), 1);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(scrollIntoViewSpy).toHaveBeenCalled();
    expect(scrollToIndex).not.toHaveBeenCalled();

    containerEl.remove();
  });

  it("containerElがnullのときは何もしない", () => {
    const onFocusItem = vi.fn();
    const { result } = renderHook(() =>
      useListKeyboardNav({
        containerEl: null,
        columnCount: 1,
        items: [makeItem("e0"), makeItem("e1")],
        onFocusItem,
      }),
    );

    result.current(0, "ArrowDown");

    expect(onFocusItem).not.toHaveBeenCalled();
  });
});
