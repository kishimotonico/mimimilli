// グループ分け（ADR-0040）の値から、タグ・述語・チップへの変換。値の検証と正規化もここ1か所で行い、
// shared の buildEffectiveCondition・server の値の検証・client のチップが同じ規則を使う。
import type { Predicate } from "./condition.ts";
import { buildBuiltinPseudoTag, isYearValue } from "./pseudoTag.ts";
import type { GroupBy } from "./smartFolder.ts";
import { normalizeTag, tagSchema, type NormalizedTag } from "./tagNormalize.ts";

/** グループの値を、グループ分けの種類に合わせて検証・正規化する。使えない値は null。
 *  tag は完全なタグ、prefix は prefix を除いた値、addedYear は4桁の年 */
export function normalizeGroupValue(by: GroupBy, value: string): string | null {
  switch (by.kind) {
    case "addedYear":
      return isYearValue(value) ? value : null;
    case "tag":
      return normalizedRealTag(value);
    case "prefix": {
      const tag = normalizedRealTag(`${by.prefix}/${value}`);
      const head = `${by.prefix}/`;
      return tag !== null && tag.startsWith(head) ? tag.slice(head.length) : null;
    }
  }
}

function normalizedRealTag(tag: string): NormalizedTag | null {
  const parsed = tagSchema.safeParse(tag);
  return parsed.success ? normalizeTag(parsed.data) : null;
}

export type GroupPredicate = Extract<Predicate, { type: "tag" | "addedYear" }>;

/** 正規化済みのグループの値を条件の述語にする */
export function groupPredicate(by: GroupBy, value: string): GroupPredicate {
  switch (by.kind) {
    case "prefix":
      return { type: "tag", tag: `${by.prefix}/${value}` };
    case "tag":
      return { type: "tag", tag: value };
    case "addedYear":
      return { type: "addedYear", year: value };
  }
}

/** 正規化済みのグループの値を、チップとして足すタグ文字列にする（追加年は擬似タグ @year/値） */
export function groupChipTag(by: GroupBy, value: string): NormalizedTag {
  const predicate = groupPredicate(by, value);
  return predicate.type === "addedYear"
    ? buildBuiltinPseudoTag("year", predicate.year)
    : (predicate.tag as NormalizedTag);
}
