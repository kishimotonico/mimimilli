// 値一覧ヘッダのコンテキスト検索（ADR-0012 §6）。表示中の値リストに対するクライアント側の
// 絞り込みで、全体検索（URL の q=）とは無関係。呼び出し側（GroupValueList）
// が useState で保持し、グループ分けの切り替えでリセットする。

import type { GroupValueItem } from "@mimimilli/shared";

export function filterGroupValueItems(items: GroupValueItem[], query: string): GroupValueItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => item.value.toLowerCase().includes(trimmed));
}
