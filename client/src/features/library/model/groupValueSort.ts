// 値一覧の並び（GroupSortId）の語彙と、列見出しの切り替え規則（ADR-0040・ADR-0041）。
// 並べるのはサーバー（GET /smart-folders/:id/groups）で、client は選んだ ID を送るだけ。

import type { GroupBy, GroupSortId } from "@mimimilli/shared";

export type SortDirection = "asc" | "desc";

/** 値一覧の列見出しになる並びの軸。最近追加した順・最近再生した順は列を持たない */
export type GroupSortColumn = "name" | "count" | "duration";

/** 並びメニューの項目（表示順）。向きは ID に含まれる */
export const GROUP_SORT_OPTIONS: { id: GroupSortId; label: string }[] = [
  { id: "count-desc", label: "件数（多い順）" },
  { id: "count-asc", label: "件数（少ない順）" },
  { id: "name-asc", label: "名前（あ→ん）" },
  { id: "name-desc", label: "名前（ん→あ）" },
  { id: "duration-desc", label: "総時間（長い順）" },
  { id: "duration-asc", label: "総時間（短い順）" },
  { id: "added-desc", label: "最近追加した順" },
  { id: "last-played", label: "最近再生した順" },
];

export const GROUP_SORT_COLUMNS: { id: GroupSortColumn; label: string }[] = [
  { id: "name", label: "名前" },
  { id: "count", label: "件数" },
  { id: "duration", label: "総時間" },
];

/** 追加年のグループ分けでは、値が年なので名前順を年の古い順・新しい順と呼ぶ */
const ADDED_YEAR_LABELS: Partial<Record<GroupSortId, string>> = {
  "name-asc": "年（古い順）",
  "name-desc": "年（新しい順）",
};

export function getGroupSortLabel(sort: GroupSortId, groupBy: GroupBy | null): string {
  if (groupBy?.kind === "addedYear" && ADDED_YEAR_LABELS[sort] !== undefined) {
    return ADDED_YEAR_LABELS[sort];
  }
  return GROUP_SORT_OPTIONS.find((option) => option.id === sort)?.label ?? sort;
}

/** そのグループ分けの並びメニュー・ダイアログの項目 */
export function groupSortOptions(groupBy: GroupBy | null): { id: GroupSortId; label: string }[] {
  return GROUP_SORT_OPTIONS.map((option) => ({
    id: option.id,
    label: getGroupSortLabel(option.id, groupBy),
  }));
}

export function groupSortColumn(sort: GroupSortId): GroupSortColumn | null {
  switch (sort) {
    case "name-asc":
    case "name-desc":
      return "name";
    case "count-asc":
    case "count-desc":
      return "count";
    case "duration-asc":
    case "duration-desc":
      return "duration";
    default:
      return null;
  }
}

export function groupSortDirection(sort: GroupSortId): SortDirection {
  return sort.endsWith("-asc") ? "asc" : "desc";
}

/** 名前順のとき、入れ子タグを階層で見せる（ADR-0012 §5） */
export function isNameSort(sort: GroupSortId): boolean {
  return groupSortColumn(sort) === "name";
}

/** 列を初めて選ぶときの向き。名前は昇順、件数・総時間は降順が自然な初期値 */
function defaultDirectionFor(column: GroupSortColumn): SortDirection {
  return column === "name" ? "asc" : "desc";
}

/** 列見出しのクリック。同じ列なら向きを反転し、別の列（最近追加・最近再生からを含む）なら既定の向きで選ぶ */
export function toggleGroupSortColumn(current: GroupSortId, column: GroupSortColumn): GroupSortId {
  const direction =
    groupSortColumn(current) === column
      ? groupSortDirection(current) === "asc"
        ? "desc"
        : "asc"
      : defaultDirectionFor(column);
  return `${column}-${direction}`;
}
