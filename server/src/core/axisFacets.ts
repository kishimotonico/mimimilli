// 分類軸のファセット集計（GET /api/axes/:axis）の純粋関数。
// 軸ID は "tag"（フラットタグ）・"year"（追加日の年）・任意の prefix 文字列（ADR-0005）。
import { parseTag } from "@mimimilli/shared";
import type { AxisFacetItem, WorkSummary } from "@mimimilli/shared";

/** 指定された分類軸について、works から値ごとの件数を集計し count 降順で返す。
 *  axis は正規形（小文字）を前提とする */
export function buildAxisFacets(axis: string, works: WorkSummary[]): AxisFacetItem[] {
  const counts = new Map<string, number>();

  for (const work of works) {
    if (axis === "tag") {
      for (const tag of work.tags) {
        if (parseTag(tag).kind === "flat") counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    } else if (axis === "year") {
      const year = work.addedAt.slice(0, 4);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    } else {
      for (const tag of work.tags) {
        const parsed = parseTag(tag);
        if (parsed.kind === "annotated" && parsed.prefix === axis) {
          counts.set(parsed.value, (counts.get(parsed.value) ?? 0) + 1);
        }
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}
