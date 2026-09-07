import { useEffect } from "react";
import type { Virtualizer, VirtualItem } from "@tanstack/react-virtual";

interface UseRovingIndexOptions {
  itemCount: number;
  /** 選択中の作品のフラットインデックス（無ければ0。itemCount===0のときは呼び出し側で
   *  -1を渡す） */
  targetIndex: number;
  virtualItems: VirtualItem[];
  virtualizer: Pick<Virtualizer<HTMLDivElement, Element>, "scrollToIndex">;
  /** フラットインデックスを、virtualizerが描画単位とする行インデックスへ変換する
   *  （グリッドは複数タイル/行、リストは1件/行で恒等） */
  toRowIndex: (flatIndex: number) => number;
  /** 行インデックスから、その行の先頭フラットインデックスを求める（フォールバック用） */
  firstFlatIndexOfRow: (rowIndex: number) => number;
}

// roving tabindexの対象（選択中の作品）が仮想化の現在描画範囲外にあると、一覧内に
// tabIndex=0を持つ要素が一つも無くなりTabで一覧に入れなくなる（TASK-428.12
// レビュー対応: URLからの深リンク復元・フィルター変更後の選択維持で発生）。
// 対象行が描画範囲内ならその位置を、範囲外なら現在描画されている先頭行の先頭項目を
// roving対象にし、同時に対象行までスクロールして次の描画で本来の対象を描画範囲へ
// 入れる。グリッド（WorkGrid）・リスト（WorkListPane）で同じ考え方を共有する。
export function useRovingIndex({
  itemCount,
  targetIndex,
  virtualItems,
  virtualizer,
  toRowIndex,
  firstFlatIndexOfRow,
}: UseRovingIndexOptions): number {
  const targetRowIndex = toRowIndex(targetIndex);

  useEffect(() => {
    if (itemCount === 0) return;
    virtualizer.scrollToIndex(targetRowIndex, { align: "auto" });
  }, [itemCount, targetRowIndex, virtualizer]);

  if (itemCount === 0) return -1;

  const isTargetRendered = virtualItems.some((item) => item.index === targetRowIndex);
  if (isTargetRendered) return targetIndex;

  return firstFlatIndexOfRow(virtualItems[0]?.index ?? 0);
}
