// グループ分けの値一覧（件数・総時間・代表カバー）の集計。
import { parseTag } from "@mimimilli/shared";
import type { GroupValueItem, GroupBy, GroupSortId, WorkSummary } from "@mimimilli/shared";
import { compareUtf8Bytes, japaneseSortKey } from "./japaneseSortKey.ts";

/** 代表カバーとして残す最大件数（値一覧の2×2コラージュ用、ADR-0012 §5） */
const MAX_COVERS = 4;

/** グループ分けの値ごとに、件数・総時間・追加と再生の最新・代表カバーを集計して groupSort の順で返す。0件の値は含まれない */
export function buildGroupValues(
  groupBy: GroupBy,
  works: WorkSummary[],
  groupSort: GroupSortId,
): GroupValueItem[] {
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
  return sortGroupValues(groupValueItems(groupBy, membersByValue), groupSort);
}

/** real の tags.search_key（tag）・tags.value_sort_key（prefix）・年（addedYear）と同じ値 */
function sortKeyOf(groupBy: GroupBy, value: string): string {
  return groupBy.kind === "addedYear" ? value : japaneseSortKey(value);
}

function maxOf(values: string[]): string | null {
  return values.reduce<string | null>(
    (max, value) => (max === null || compareUtf8Bytes(value, max) > 0 ? value : max),
    null,
  );
}

function groupValueItems(
  groupBy: GroupBy,
  membersByValue: Map<string, WorkSummary[]>,
): GroupValueItem[] {
  return [...membersByValue.entries()].map(([value, members]) => ({
    value,
    sortKey: sortKeyOf(groupBy, value),
    lastAddedAt: maxOf(members.map((work) => work.addedAt))!,
    lastPlayedAt: maxOf(members.flatMap((work) => (work.lastPlayedAt ? [work.lastPlayedAt] : []))),
    count: members.length,
    durationSec: members.reduce((sum, work) => sum + (work.totalDurationSec ?? 0), 0),
    covers: [...members]
      .sort((a, b) => compareUtf8Bytes(b.addedAt, a.addedAt) || compareUtf8Bytes(a.id, b.id))
      .flatMap((work) => (work.cover ? [{ ...work.cover, workId: work.id }] : []))
      .slice(0, MAX_COVERS),
  }));
}

type ValueComparator = (a: GroupValueItem, b: GroupValueItem) => number;

const byCount: ValueComparator = (a, b) => a.count - b.count;
const byDuration: ValueComparator = (a, b) => a.durationSec - b.durationSec;
const byName: ValueComparator = (a, b) =>
  compareUtf8Bytes(a.sortKey, b.sortKey) || compareUtf8Bytes(a.value, b.value);
const byAdded: ValueComparator = (a, b) => compareUtf8Bytes(a.lastAddedAt, b.lastAddedAt);
/** 新しい再生が先。再生したことのない値は末尾 */
const byPlayedRecent: ValueComparator = (a, b) => {
  if (a.lastPlayedAt === null || b.lastPlayedAt === null) {
    return Number(a.lastPlayedAt === null) - Number(b.lastPlayedAt === null);
  }
  return compareUtf8Bytes(b.lastPlayedAt, a.lastPlayedAt);
};

const GROUP_SORT_COMPARATORS: Record<GroupSortId, ValueComparator> = {
  "count-desc": (a, b) => byCount(b, a) || byName(a, b),
  "count-asc": (a, b) => byCount(a, b) || byName(a, b),
  "name-asc": byName,
  "name-desc": (a, b) => byName(b, a),
  "duration-desc": (a, b) => byDuration(b, a) || byName(a, b),
  "duration-asc": (a, b) => byDuration(a, b) || byName(a, b),
  "added-desc": (a, b) => byAdded(b, a) || byName(a, b),
  "last-played": (a, b) => byPlayedRecent(a, b) || byName(a, b),
};

function sortGroupValues(items: GroupValueItem[], groupSort: GroupSortId): GroupValueItem[] {
  return items.sort(GROUP_SORT_COMPARATORS[groupSort]);
}
