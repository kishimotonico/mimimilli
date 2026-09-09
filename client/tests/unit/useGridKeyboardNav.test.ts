import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import { useGridKeyboardNav } from "../../src/features/library/ui/useGridKeyboardNav";
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

describe("useGridKeyboardNav", () => {
  it("rowIndexOfFlatIndexが解決できたときはフォーカス移動とscrollToIndexを行う", () => {
    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const gridEl = document.createElement("div");
    const item0 = makeItem("w0");
    const item1 = makeItem("w1");

    const { result } = renderHook(() =>
      useGridKeyboardNav({
        gridEl,
        isJustified: false,
        justifiedLayout: null,
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

  // レビュー対応: rowIndexOfFlatIndexがundefinedを返す（対応するタイルが無い）とき、
  // 旧実装と同じく「行0として扱いscrollToIndexする」のではなく何もしない。
  it("rowIndexOfFlatIndexがundefinedのときはフォーカス移動もscrollToIndexも行わない", () => {
    (gridNavigation.rowIndexOfFlatIndex as Mock).mockReturnValue(undefined);

    const scrollToIndex = vi.fn();
    const onFocusItem = vi.fn();
    const gridEl = document.createElement("div");
    const item0 = makeItem("w0");
    const item1 = makeItem("w1");

    const { result } = renderHook(() =>
      useGridKeyboardNav({
        gridEl,
        isJustified: true,
        justifiedLayout: {
          tiles: [
            { rowIndex: 0, centerX: 0 },
            { rowIndex: 0, centerX: 10 },
          ],
        } as never,
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
});
