import type { VirtualItem } from "@tanstack/react-virtual";

/** 仮想リストの末尾検出（TASK-59）。
 *  末尾から overscan 行以内の仮想アイテムがレンダリングされていれば次ページを読み込む。 */
export function shouldLoadMore(
  virtualItems: Pick<VirtualItem, "index">[],
  count: number,
  overscan: number,
): boolean {
  if (virtualItems.length === 0) return false;
  const lastItem = virtualItems[virtualItems.length - 1];
  return lastItem.index >= count - 1 - overscan;
}
