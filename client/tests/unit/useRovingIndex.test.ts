import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRovingIndex } from "../../src/features/library/ui/useRovingIndex";

function virtualItem(index: number) {
  return { index } as never;
}

const identity = (i: number) => i;

describe("useRovingIndex", () => {
  it("対象が現在描画範囲内にあれば、そのままroving対象にする", () => {
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 20,
        targetIndex: 5,
        virtualItems: [virtualItem(4), virtualItem(5), virtualItem(6)],
        toRowIndex: identity,
        firstFlatIndexOfRow: identity,
      }),
    );
    expect(result.current).toBe(5);
  });

  // 対象が仮想化の描画範囲外（URLからの深リンク復元・フィルター変更後に選択だけ残る等）
  // だと、roving tabindex(=0)を持つ要素が一覧に一つも無くなりTabで一覧へ入れなくなる。
  it("対象が描画範囲外なら、描画されている先頭行の先頭項目へフォールバックする", () => {
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 500,
        targetIndex: 480,
        virtualItems: [virtualItem(10), virtualItem(11), virtualItem(12)],
        toRowIndex: identity,
        firstFlatIndexOfRow: identity,
      }),
    );
    expect(result.current).toBe(10);
  });

  it("対象なし(null)なら、描画されている先頭行の先頭項目をroving対象にする", () => {
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 500,
        targetIndex: null,
        virtualItems: [virtualItem(30), virtualItem(31)],
        toRowIndex: identity,
        firstFlatIndexOfRow: identity,
      }),
    );
    expect(result.current).toBe(30);
  });

  it("対象の行が未解決(undefined)なら、描画されている先頭行の先頭項目へフォールバックする", () => {
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 10,
        targetIndex: 3,
        virtualItems: [virtualItem(0), virtualItem(1)],
        toRowIndex: () => undefined,
        firstFlatIndexOfRow: (row) => row * 4,
      }),
    );
    expect(result.current).toBe(0);
  });

  it("グリッドのように行が複数タイルを含む場合も、行単位で範囲判定する", () => {
    const columnCount = 4;
    // targetIndex=9は行2（8-11が行2）。行2が描画範囲内ならそのまま返す。
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 40,
        targetIndex: 9,
        virtualItems: [virtualItem(1), virtualItem(2)],
        toRowIndex: (i) => Math.floor(i / columnCount),
        firstFlatIndexOfRow: (row) => row * columnCount,
      }),
    );
    expect(result.current).toBe(9);
  });

  it("グリッドで先頭行が描画範囲の途中から始まるとき、その行の先頭タイルへフォールバックする", () => {
    const columnCount = 4;
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 400,
        targetIndex: null,
        virtualItems: [virtualItem(20), virtualItem(21)],
        toRowIndex: (i) => Math.floor(i / columnCount),
        firstFlatIndexOfRow: (row) => row * columnCount,
      }),
    );
    expect(result.current).toBe(80);
  });

  it("itemCount===0のときは-1を返す", () => {
    const { result } = renderHook(() =>
      useRovingIndex({
        itemCount: 0,
        targetIndex: null,
        virtualItems: [],
        toRowIndex: identity,
        firstFlatIndexOfRow: identity,
      }),
    );
    expect(result.current).toBe(-1);
  });
});
