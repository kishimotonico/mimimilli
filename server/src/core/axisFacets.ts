// グループ分けの値一覧（件数・総時間・代表カバー）の集計。
import { parseTag } from "@mimimilli/shared";
import type { AxisFacetItem, GroupBy, WorkSummary } from "@mimimilli/shared";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "./japaneseSortKey.ts";

/** 代表カバーとして残す最大件数（値一覧の2×2コラージュ用、ADR-0012 §5） */
const MAX_COVERS = 4;

/** グループ分けの値ごとに、件数・総時間・代表カバーを集計して count 降順で返す。0件の値は含まれない */
export function buildGroupFacets(groupBy: GroupBy, works: WorkSummary[]): AxisFacetItem[] {
  const membersByValue = new Map<string, WorkSummary[]>();
  const addMember = (value: string, work: WorkSummary) => {
    const members = membersByValue.get(value);
    if (members) members.push(work);
    else membersByValue.set(value, [work]);
  };
  for (const work of works) {
    if (groupBy.kind === "addedYear") {
      addMember(work.addedAt.slice(0, 4), work);
      continue;
    }
    for (const tag of work.tags) {
      if (groupBy.kind === "tag") {
        addMember(tag, work);
        continue;
      }
      const parsed = parseTag(tag);
      if (parsed.kind === "annotated" && parsed.prefix === groupBy.prefix) {
        addMember(parsed.value, work);
      }
    }
  }
  return facetItems(membersByValue);
}

function facetItems(membersByValue: Map<string, WorkSummary[]>): AxisFacetItem[] {
  return [...membersByValue.entries()]
    .map(([value, members]) => ({
      value,
      count: members.length,
      durationSec: members.reduce((sum, work) => sum + (work.totalDurationSec ?? 0), 0),
      covers: [...members]
        .sort((a, b) => compareUtf8Bytes(b.addedAt, a.addedAt) || compareUtf8Bytes(a.id, b.id))
        .flatMap((work) => (work.cover ? [{ ...work.cover, workId: work.id }] : []))
        .slice(0, MAX_COVERS),
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        compareJapaneseSortKeys(a.value, b.value) ||
        compareUtf8Bytes(a.value, b.value),
    );
}
