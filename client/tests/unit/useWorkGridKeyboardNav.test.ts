import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { WorkListItem } from "@mimimilli/shared";
import { useWorkGridKeyboardNav } from "../../src/features/library/ui/workGrid/useWorkGridKeyboardNav";
import * as gridNavigation from "../../src/features/library/model/gridNavigation";

vi.mock("../../src/features/library/model/gridNavigation", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/features/library/model/gridNavigation")>();
  return { ...actual, rowIndexOfFlatIndex: vi.fn(actual.rowIndexOfFlatIndex) };
});

function makeWork(id: string): WorkListItem {
  return { id } as WorkListItem;
}

describe("useWorkGridKeyboardNav", () => {
  it("rowIndexOfFlatIndexが解決できたときは選択とscrollToIndexを行う", () => {
    const scrollToIndex = vi.fn();
    const onWorkSelect = vi.fn();
    const gridEl = document.createElement("div");
    const work0 = makeWork("w0");
    const work1 = makeWork("w1");

    const { result } = renderHook(() =>
      useWorkGridKeyboardNav({
        gridEl,
        isJustified: false,
        justifiedLayout: null,
        columnCount: 3,
        works: [work0, work1],
        onWorkSelect,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    result.current(0, "ArrowRight");

    expect(onWorkSelect).toHaveBeenCalledWith("w1");
    expect(scrollToIndex).toHaveBeenCalled();
  });

  // レビュー対応: rowIndexOfFlatIndexがundefinedを返す（対応するタイルが無い）とき、
  // 旧実装と同じく「行0として扱いscrollToIndexする」のではなく何もしない。
  it("rowIndexOfFlatIndexがundefinedのときは選択もscrollToIndexも行わない", () => {
    (gridNavigation.rowIndexOfFlatIndex as Mock).mockReturnValue(undefined);

    const scrollToIndex = vi.fn();
    const onWorkSelect = vi.fn();
    const gridEl = document.createElement("div");
    const work0 = makeWork("w0");
    const work1 = makeWork("w1");

    const { result } = renderHook(() =>
      useWorkGridKeyboardNav({
        gridEl,
        isJustified: true,
        justifiedLayout: {
          tiles: [
            { rowIndex: 0, centerX: 0 },
            { rowIndex: 0, centerX: 10 },
          ],
        } as never,
        columnCount: 3,
        works: [work0, work1],
        onWorkSelect,
        virtualizer: { scrollToIndex } as never,
      }),
    );

    result.current(0, "ArrowRight");

    expect(onWorkSelect).not.toHaveBeenCalled();
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
});
