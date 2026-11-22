import type { GroupValueItem } from "@mimimilli/shared";
import { filterGroupValueItems } from "./groupValueFilter";
import { sortGroupValueItems, type GroupValueSortState } from "./groupValueSort";
import {
  buildGroupValueHierarchy,
  flattenGroupValueRows,
  type GroupValueHierarchyRow,
} from "./groupValueHierarchy";

export function buildGroupValueDisplayRows(
  items: GroupValueItem[],
  query: string,
  sort: GroupValueSortState,
): GroupValueHierarchyRow[] {
  const filtered = filterGroupValueItems(items, query);
  return sort.key === "name"
    ? buildGroupValueHierarchy(filtered, sort.direction)
    : flattenGroupValueRows(sortGroupValueItems(filtered, sort));
}
