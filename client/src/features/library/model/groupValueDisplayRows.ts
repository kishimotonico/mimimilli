import type { GroupSortId, GroupValueItem } from "@mimimilli/shared";
import { filterGroupValueItems } from "./groupValueFilter";
import { isNameSort } from "./groupValueSort";
import {
  buildGroupValueHierarchy,
  flattenGroupValueRows,
  type GroupValueHierarchyRow,
} from "./groupValueHierarchy";

/** items はサーバーが並べた順。名前順のときだけ入れ子の値を階層にし、どの並びでも順は変えない */
export function buildGroupValueDisplayRows(
  items: GroupValueItem[],
  query: string,
  sort: GroupSortId,
): GroupValueHierarchyRow[] {
  const filtered = filterGroupValueItems(items, query);
  return isNameSort(sort) ? buildGroupValueHierarchy(filtered) : flattenGroupValueRows(filtered);
}
