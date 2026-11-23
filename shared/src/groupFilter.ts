// グループ分け（ADR-0040）の定義と、その値から、タグ・述語・チップへの変換。値の検証と正規化もここ1か所で行い、
// shared の buildEffectiveCondition・server の値の検証・client のチップが同じ規則を使う。
import { z } from "zod";
import {
  EMPTY_CONDITION,
  normalizeSearchQuery,
  prefixSchema,
  type Condition,
  type Predicate,
} from "./condition.ts";
import type { GroupSortId } from "./library.ts";
import { buildBuiltinPseudoTag, isYearValue, type TagFilters } from "./pseudoTag.ts";
import { normalizeTag, tagSchema, type NormalizedTag } from "./tagNormalize.ts";

export const groupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prefix"), prefix: prefixSchema }),
  z.object({ kind: z.literal("tag") }),
  z.object({ kind: z.literal("addedYear") }),
]);
export type GroupBy = z.infer<typeof groupBySchema>;

/** グループ分けを一意に表す文字列（`prefix:cv`・`tag`・`addedYear`）。クエリ文字列とキャッシュキーに使う */
export function groupByKey(groupBy: GroupBy): string {
  return groupBy.kind === "prefix" ? `prefix:${groupBy.prefix}` : groupBy.kind;
}

/** groupByKey の逆。読めない文字列は null */
export function parseGroupByKey(key: string): GroupBy | null {
  const candidate = key.startsWith("prefix:")
    ? { kind: "prefix", prefix: key.slice("prefix:".length) }
    : { kind: key };
  const parsed = groupBySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** グループ分けを付けたときの値の並びの初期値。追加年は新しい年が先、それ以外は件数の多い順 */
export function defaultGroupSort(groupBy: GroupBy): GroupSortId {
  return groupBy.kind === "addedYear" ? "name-desc" : "count-desc";
}

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

export interface EffectiveConditionInput {
  /** スマートフォルダーの条件 */
  condition: Condition;
  /** 選択中のグループの値 */
  group?: { by: GroupBy; value: string };
  /** チップ。擬似タグ @year/… は分解済みの yearValue で届く */
  tags?: TagFilters;
  /** 前後の空白は落とす（保存スキーマの text と同じ正規形）。空なら text を足さない */
  q?: string;
}

/** スマートフォルダー・グループの値・チップ・検索語から1本の木を作る。
 *  サーバーの評価と、クライアントの「検索を保存」「上書き」が同じ規則を使う */
export function buildEffectiveCondition(input: EffectiveConditionInput): Condition {
  const { condition } = input;
  const children: Condition[] = condition.type === "and" ? [...condition.children] : [condition];
  if (input.group) children.push(groupPredicate(input.group.by, input.group.value));
  for (const tag of input.tags?.tags ?? []) children.push({ type: "tag", tag });
  if (input.tags?.yearValue != null)
    children.push({ type: "addedYear", year: input.tags.yearValue });
  const q = normalizeSearchQuery(input.q);
  if (q) children.push({ type: "text", q });
  return children.length === 0 ? EMPTY_CONDITION : { type: "and", children };
}
