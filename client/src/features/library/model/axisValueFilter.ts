// 値一覧ヘッダのコンテキスト検索（ADR-0012 §6）。表示中の値リストに対するクライアント側の
// 絞り込みで、librarySearchQueryAtom（全体検索・URL の q=）とは無関係。呼び出し側（AxisValueList）
// が useState で保持し、軸切り替えでリセットする。

import type { AxisFacetItem } from "@mimimilli/shared";
import type { AxisValueNameKeyFn } from "./axisValueSort";
import { defaultAxisValueNameKey } from "./axisValueSort";

export function filterAxisValueItems(
  items: AxisFacetItem[],
  query: string,
  getNameKey: AxisValueNameKeyFn = defaultAxisValueNameKey,
): AxisFacetItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) => getNameKey(item).toLowerCase().includes(trimmed));
}
