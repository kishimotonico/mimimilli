// 値一覧ヘッダのコンテキスト検索（ADR-0012 §6）。表示中の値リストに対するクライアント側の
// 絞り込みで、librarySearchQueryAtom（全体検索・URL の q=）とは無関係。呼び出し側（AxisValueList）
// が useState で保持し、軸切り替えでリセットする。

import type { AxisFacetItem } from "@mimimilli/shared";

export function filterAxisValueItems(items: AxisFacetItem[], query: string): AxisFacetItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => item.value.toLowerCase().includes(trimmed));
}
