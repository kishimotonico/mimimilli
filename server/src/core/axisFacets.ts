// 分類軸のファセット集計（GET /api/axes/:axis）の純粋関数。
// 軸ID は "tag"（全タグ。flat・annotated 双方）・"year"（追加日の年）・
// 任意の prefix 文字列（ADR-0005 追記）。
import { parseTag } from "@mimimilli/shared";
import type { AxisFacetItem, TagFilters, WorkSummary } from "@mimimilli/shared";
import { EMPTY_TAG_FILTERS } from "@mimimilli/shared";
import { compareJapaneseSortKeys, compareUtf8Bytes } from "./japaneseSortKey.ts";
import { filterByTags, filterByYear } from "./worksQuery.ts";

/** 代表カバーとして残す最大件数（値一覧の2×2コラージュ用、ADR-0012 §5） */
const MAX_COVERS = 4;

/** GET /axes/:axis の絞り込み。組み込み軸 year も TagFilters 経由で渡る（ADR-0012 §2、TASK-199）。
 *  自軸由来のフィルタを除いた集合を渡すのは呼び出し側の責務（TASK-187） */
export interface AxisFacetsFilterInput {
  tags?: TagFilters;
  tagOp?: "AND" | "OR";
}

/** 指定された分類軸について、works から値ごとの件数・総時間・代表カバーを集計し count 降順で返す。
 *  axis は正規形（小文字）を前提とする。filter が渡された場合、集計対象を先に絞り込む
 *  （自軸除外カウント、TASK-187）。0件になった値は結果に含まれない（自然に除外される）。 */
export function buildAxisFacets(
  axis: string,
  works: WorkSummary[],
  filter?: AxisFacetsFilterInput,
): AxisFacetItem[] {
  const { tags, yearValue } = filter?.tags ?? EMPTY_TAG_FILTERS;
  const filteredWorks = filter
    ? filterByYear(filterByTags(works, tags, filter.tagOp ?? "AND"), yearValue)
    : works;

  const membersByValue = new Map<string, WorkSummary[]>();

  const addMember = (value: string, work: WorkSummary) => {
    const members = membersByValue.get(value);
    if (members) {
      members.push(work);
    } else {
      membersByValue.set(value, [work]);
    }
  };

  for (const work of filteredWorks) {
    if (axis === "tag") {
      // タグ軸は flat・annotated を問わず全タグを集計する（prefix グループ見出し付き表示用）。
      // value は完全なタグ文字列（例: "cv/藤田茜"）を保持し、AND 絞り込みへそのまま使える
      for (const tag of work.tags) {
        addMember(tag, work);
      }
    } else if (axis === "year") {
      addMember(work.addedAt.slice(0, 4), work);
    } else {
      for (const tag of work.tags) {
        const parsed = parseTag(tag);
        if (parsed.kind === "annotated" && parsed.prefix === axis) {
          addMember(parsed.value, work);
        }
      }
    }
  }

  return [...membersByValue.entries()]
    .map(([value, members]) => ({
      value,
      count: members.length,
      durationSec: members.reduce((sum, work) => sum + (work.totalDurationSec ?? 0), 0),
      covers: [...members]
        .sort((a, b) => compareUtf8Bytes(b.addedAt, a.addedAt))
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
