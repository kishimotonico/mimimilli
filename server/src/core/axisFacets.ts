// 分類軸のファセット集計（GET /api/axes/:axis）の純粋関数。
// client/mocks/handlers/library.ts の buildAxisFacetItems と同じセマンティクスを再現する。
import { AXIS_TAG_PREFIX } from "@mimikago/shared";
import type { AxisFacetItem, FacetAxis, WorkSummary } from "@mimikago/shared";

/** 指定された分類軸について、works から値ごとの件数を集計し count 降順で返す */
export function buildAxisFacets(axis: FacetAxis, works: WorkSummary[]): AxisFacetItem[] {
  const prefix = AXIS_TAG_PREFIX[axis];
  const counts = new Map<string, number>();

  for (const work of works) {
    if (axis === "tag") {
      for (const tag of work.tags) {
        if (!tag.includes("/")) counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    } else if (axis === "year") {
      const year = work.addedAt.slice(0, 4);
      counts.set(year, (counts.get(year) ?? 0) + 1);
    } else if (prefix) {
      for (const tag of work.tags) {
        if (tag.startsWith(prefix)) {
          const value = tag.slice(prefix.length);
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
      }
    }
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}
