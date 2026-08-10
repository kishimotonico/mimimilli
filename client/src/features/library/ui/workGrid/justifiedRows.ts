import type { WorkListItem } from "@mimimilli/shared";
import type { JustifiedLayout } from "../../model/justifiedLayout";

export interface JustifiedRowGroup {
  rowIndex: number;
  height: number;
  entries: { work: WorkListItem; width: number; flatIndex: number }[];
}

export function isJustifiedLayoutRevision(value: unknown): value is JustifiedLayout {
  if (typeof value !== "object" || value === null) return false;
  return "tiles" in value && "rowHeights" in value;
}

export function groupJustifiedRows(
  works: WorkListItem[],
  layout: JustifiedLayout,
): JustifiedRowGroup[] {
  const rows: JustifiedRowGroup[] = [];
  layout.tiles.forEach((tile, flatIndex) => {
    const work = works[flatIndex];
    if (!work) return;
    let row = rows[tile.rowIndex];
    if (!row) {
      row = { rowIndex: tile.rowIndex, height: layout.rowHeights[tile.rowIndex] ?? 0, entries: [] };
      rows[tile.rowIndex] = row;
    }
    row.entries.push({ work, width: tile.width, flatIndex });
  });
  return rows;
}
