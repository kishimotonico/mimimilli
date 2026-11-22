import type { GroupSortId, GroupValueItem } from "@mimimilli/shared";
import { filterGroupValueItems } from "./groupValueFilter";
import { groupSortDirection, isNameSort } from "./groupValueSort";
import {
  buildGroupValueHierarchy,
  flattenGroupValueRows,
  type GroupValueHierarchyRow,
} from "./groupValueHierarchy";

/** items はサーバーが並べた順。入れ子の値（`/` を含む）が名前順のときだけ階層にし、それ以外は順をそのまま見せる */
export function buildGroupValueDisplayRows(
  items: GroupValueItem[],
  query: string,
  sort: GroupSortId,
): GroupValueHierarchyRow[] {
  const filtered = filterGroupValueItems(items, query);
  const nested = filtered.some((item) => item.value.includes("/"));
  return isNameSort(sort) && nested
    ? buildGroupValueHierarchy(filtered, groupSortDirection(sort))
    : flattenGroupValueRows(filtered);
}
