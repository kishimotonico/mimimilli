import type { AxisValueHierarchyRow } from "./axisValueHierarchy";

export type AxisValueRowArrowKey = "ArrowUp" | "ArrowDown" | "Home" | "End";

function isValueRow(row: AxisValueHierarchyRow | undefined): boolean {
  return row?.kind === "value";
}

// 値一覧（AxisValueRows・AxisValueQuickList）の矢印キーナビ。見出し行（選択不可）は
// 対象から飛ばす点だけが gridNavigation.ts の getNextGridIndex と異なる
// （境界での挙動は同じくクランプ。作品一覧と同じ規則に揃える。TASK-436）。
export function getNextAxisValueRowIndex(
  rows: readonly AxisValueHierarchyRow[],
  currentIndex: number,
  key: AxisValueRowArrowKey,
): number {
  if (rows.length === 0) return -1;

  if (key === "Home") return rows.findIndex((row) => row.kind === "value");
  if (key === "End") {
    for (let index = rows.length - 1; index >= 0; index--) {
      if (rows[index]?.kind === "value") return index;
    }
    return -1;
  }

  const delta = key === "ArrowDown" ? 1 : -1;
  for (let index = currentIndex + delta; index >= 0 && index < rows.length; index += delta) {
    if (isValueRow(rows[index])) return index;
  }
  return currentIndex;
}

/** roving tabindexの対象が見出し行（選択不可）を指してしまったときに、直近の値行へ
 *  寄せる。仮想化のフォールバック（先頭描画行）が見出し行に当たるケースで使う。 */
export function nearestValueRowIndex(rows: readonly AxisValueHierarchyRow[], from: number): number {
  if (isValueRow(rows[from])) return from;
  for (let index = from; index < rows.length; index++) {
    if (isValueRow(rows[index])) return index;
  }
  for (let index = from - 1; index >= 0; index--) {
    if (isValueRow(rows[index])) return index;
  }
  return -1;
}
