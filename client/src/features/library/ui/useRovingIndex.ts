import type { VirtualItem } from "@tanstack/react-virtual";

interface UseRovingIndexOptions {
  itemCount: number;
  /** roving対象にしたい項目のフラットインデックス。対象なし（選択なし等）はnull */
  targetIndex: number | null;
  virtualItems: VirtualItem[];
  /** フラットインデックスを、virtualizerが描画単位とする行インデックスへ変換する
   *  （グリッドは複数タイル/行、リストは1件/行で恒等）。行がまだ解決できなければundefined */
  toRowIndex: (flatIndex: number) => number | undefined;
  /** 行インデックスから、その行の先頭フラットインデックスを求める（フォールバック用） */
  firstFlatIndexOfRow: (rowIndex: number) => number;
}

// roving tabindexの対象が仮想化の現在描画範囲外にあると、一覧内にtabIndex=0を持つ要素が
// 一つも無くなりTabで一覧に入れなくなる。対象が描画範囲内ならその位置を、対象なし・
// 範囲外・行未解決なら現在描画されている先頭行の先頭項目をroving対象にする。
// スクロールは行わない（選択を画面内へ寄せるのは呼び出し側の責務）。
export function useRovingIndex({
  itemCount,
  targetIndex,
  virtualItems,
  toRowIndex,
  firstFlatIndexOfRow,
}: UseRovingIndexOptions): number {
  if (itemCount === 0) return -1;

  if (targetIndex !== null) {
    const targetRowIndex = toRowIndex(targetIndex);
    if (
      targetRowIndex !== undefined &&
      virtualItems.some((item) => item.index === targetRowIndex)
    ) {
      return targetIndex;
    }
  }

  return firstFlatIndexOfRow(virtualItems[0]?.index ?? 0);
}
