import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useRovingIndex } from "../../src/features/library/ui/useRovingIndex";

function virtualItem(index: number) {
  return { index } as never;
}

describe("useRovingIndex", () => {
  it("選択中の作品が現在描画範囲内にあれば、そのままroving対象にする", () => {
    const scrollToIndex = vi.fn();
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 20,
        targetIndex: 5,
        virtualItems: [virtualItem(4), virtualItem(5), virtualItem(6)],
        virtualizer: { scrollToIndex },
        toRowIndex: (i) => i,
        firstFlatIndexOfRow: (i) => i,
      }),
    );
    expect(result.current).toBe(5);
  });

  // 選択中の作品が仮想化の描画範囲外（URLからの深リンク復元・フィルター変更後に
  // 選択だけ残る等）だと、roving tabindex(=0)を持つ要素が一覧に一つも無くなり
  // Tabで一覧へ入れなくなる。
  it("選択中の作品が描画範囲外なら、描画されている先頭行の先頭項目へフォールバックする", () => {
    const scrollToIndex = vi.fn();
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 500,
        // 深リンクで選択された作品が末尾付近にあり、初期描画は先頭付近のみ
        targetIndex: 480,
        virtualItems: [virtualItem(0), virtualItem(1), virtualItem(2)],
        virtualizer: { scrollToIndex },
        toRowIndex: (i) => i,
        firstFlatIndexOfRow: (i) => i,
      }),
    );
    // 描画範囲外にフォールできない -1 ではなく、実在する描画済み行を返す
    expect(result.current).toBe(0);
    expect(result.current).not.toBe(-1);
  });

  it("フォールバック中でも対象行までscrollToIndexし、次の描画で範囲内へ入れようとする", () => {
    const scrollToIndex = vi.fn();
    renderHook(() =>
      useRovingIndex({
        itemCount: 500,
        targetIndex: 480,
        virtualItems: [virtualItem(0), virtualItem(1), virtualItem(2)],
        virtualizer: { scrollToIndex },
        toRowIndex: (i) => i,
        firstFlatIndexOfRow: (i) => i,
      }),
    );
    expect(scrollToIndex).toHaveBeenCalledWith(480, { align: "auto" });
  });

  it("グリッドのように行が複数タイルを含む場合も、行単位で範囲判定する", () => {
    const scrollToIndex = vi.fn();
    const columnCount = 4;
    // targetIndex=9は行2（columnCount=4なので8-11が行2）。行2が描画範囲内なら
    // フォールバックせずtargetIndexをそのまま返す。
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 40,
        targetIndex: 9,
        virtualItems: [virtualItem(1), virtualItem(2)],
        virtualizer: { scrollToIndex },
        toRowIndex: (i) => Math.floor(i / columnCount),
        firstFlatIndexOfRow: (row) => row * columnCount,
      }),
    );
    expect(result.current).toBe(9);
  });

  it("itemCount===0のときは-1を返し、スクロールもしない", () => {
    const scrollToIndex = vi.fn();
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 0,
        targetIndex: -1,
        virtualItems: [],
        virtualizer: { scrollToIndex },
        toRowIndex: (i) => i,
        firstFlatIndexOfRow: (i) => i,
      }),
    );
    expect(result.current).toBe(-1);
    expect(scrollToIndex).not.toHaveBeenCalled();
  });
});
