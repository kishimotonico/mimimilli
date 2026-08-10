import type { AxisFacetItem } from "@mimimilli/shared";
import { filterAxisValueItems } from "./axisValueFilter";
import { sortAxisValueItems, type AxisValueSortState } from "./axisValueSort";
import {
  buildAxisValueHierarchy,
  flattenAxisValueRows,
  type AxisValueHierarchyRow,
} from "./axisValueHierarchy";

export function buildAxisValueDisplayRows(
  items: AxisFacetItem[],
  query: string,
  sort: AxisValueSortState,
): AxisValueHierarchyRow[] {
  const filtered = filterAxisValueItems(items, query);
  return sort.key === "name"
    ? buildAxisValueHierarchy(filtered, sort.direction)
    : flattenAxisValueRows(sortAxisValueItems(filtered, sort));
}
