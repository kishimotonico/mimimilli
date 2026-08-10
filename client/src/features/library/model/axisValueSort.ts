// 値一覧（AxisValueList）のソート状態・ソート計算。ADR-0012 §5・帰結。
// ソートは UI が単一系・state が二重: ソートメニュー（LibrarySortMenu）と list の列見出し
// クリック（AxisValueList）は同じ AxisValueSortState への別入口だが、作品一覧のソート状態
// （sortAtom）とは別に保持する。総時間ソート中に値を選択しても作品一覧が無効なソートキーを
// 受け取らないようにするための分離（ADR-0012 帰結）。

import type { AxisFacetItem } from "@mimimilli/shared";

export type AxisValueSortKey = "name" | "count" | "duration";
export type SortDirection = "asc" | "desc";

export interface AxisValueSortState {
  key: AxisValueSortKey;
  direction: SortDirection;
}

export const DEFAULT_AXIS_VALUE_SORT: AxisValueSortState = { key: "count", direction: "desc" };

export const AXIS_VALUE_SORT_OPTIONS: { id: AxisValueSortKey; label: string }[] = [
  { id: "name", label: "名前" },
  { id: "count", label: "件数" },
  { id: "duration", label: "総時間" },
];

/** ソートキーの既定の向き（メニューから新しいキーへ切り替えたとき・列見出しを初めて
 *  クリックしたときに使う）。名前は昇順、件数・総時間は降順が自然な初期値。 */
function defaultDirectionFor(key: AxisValueSortKey): SortDirection {
  return key === "name" ? "asc" : "desc";
}

/** ソートメニューからキーを選ぶ（既に選択中のキーなら何もしない）。 */
export function selectAxisValueSortKey(
  current: AxisValueSortState,
  key: AxisValueSortKey,
): AxisValueSortState {
  if (current.key === key) return current;
  return { key, direction: defaultDirectionFor(key) };
}

/** list の列見出しクリック。同じ列なら昇順降順を反転、別の列なら既定の向きへ切り替える。 */
export function toggleAxisValueSort(
  current: AxisValueSortState,
  key: AxisValueSortKey,
): AxisValueSortState {
  if (current.key !== key) return { key, direction: defaultDirectionFor(key) };
  return { key, direction: current.direction === "asc" ? "desc" : "asc" };
}

/** 値からソートキー（表示名）を導く。既定は表示名（value）そのままの単純比較。 */
function axisValueNameKey(item: AxisFacetItem): string {
  return item.value;
}

export function sortAxisValueItems(
  items: AxisFacetItem[],
  sort: AxisValueSortState,
): AxisFacetItem[] {
  const dir = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sort.key === "name") {
      cmp = axisValueNameKey(a).localeCompare(axisValueNameKey(b), "ja");
    } else if (sort.key === "count") {
      cmp = a.count - b.count;
    } else {
      cmp = a.durationSec - b.durationSec;
    }
    if (cmp === 0) cmp = axisValueNameKey(a).localeCompare(axisValueNameKey(b), "ja");
    return cmp * dir;
  });
}
