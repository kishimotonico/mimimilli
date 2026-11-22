// スマートフォルダーの条件の木（ADR-0040）。保存できる形の検証・正規化・形の判定を持つ。
// 評価（matchCondition / compileCondition）は server 側の責務でここには置かない。
// 絞り込みを重ねた1本の木の組み立て（buildEffectiveCondition）は、サーバーの評価と
// クライアントの保存が同じ規則を使うためここに置く。
import { z } from "zod";
import { groupPredicate } from "./groupFilter.ts";
import { YEAR_VALUE_PATTERN, type TagFilters } from "./pseudoTag.ts";
import type { GroupBy } from "./smartFolder.ts";
import { normalizeTag, tagSchema } from "./tagNormalize.ts";

export type Condition =
  | { type: "and"; children: Condition[] }
  | { type: "or"; children: Condition[] }
  | { type: "not"; child: Condition }
  | { type: "tag"; tag: string }
  | { type: "hasPrefix"; prefix: string }
  | { type: "duration"; op: "gte" | "lte"; sec: number }
  | { type: "bookmarked" }
  | { type: "played"; withinDays?: number }
  | { type: "added"; withinDays: number }
  | { type: "addedYear"; year: string }
  | { type: "hasError" }
  | { type: "text"; q: string };

export type PredicateType = Exclude<Condition["type"], "and" | "or" | "not">;
export type Predicate = Extract<Condition, { type: PredicateType }>;

const PREDICATE_TYPES: ReadonlySet<string> = new Set<PredicateType>([
  "tag",
  "hasPrefix",
  "duration",
  "bookmarked",
  "played",
  "added",
  "addedYear",
  "hasError",
  "text",
]);

export function isPredicate(condition: Condition): condition is Predicate {
  return PREDICATE_TYPES.has(condition.type);
}

/** prefix の正規形（trim・小文字化。スラッシュを含まない） */
export const prefixSchema = z
  .string()
  .trim()
  .min(1)
  .transform((s) => s.toLowerCase())
  .refine((s) => !s.includes("/"), { message: "prefix にスラッシュは使えません" });

/** 日数の上限（約100年）。基準時刻からの日付計算が範囲外にならない値 */
export const MAX_WITHIN_DAYS = 36500;
const positiveInt = z.number().int().positive().max(MAX_WITHIN_DAYS);

type ObjectFactory = <T extends z.ZodRawShape>(shape: T) => z.ZodObject<T>;

function treeSchema(
  object: ObjectFactory,
  tag: z.ZodType<string>,
  prefix: z.ZodType<string>,
  q: z.ZodType<string>,
): z.ZodType<Condition> {
  const node: z.ZodType<Condition> = z.lazy(() =>
    z.union([
      object({ type: z.literal("and"), children: z.array(node) }),
      object({ type: z.literal("or"), children: z.array(node) }),
      object({ type: z.literal("not"), child: node }),
      object({ type: z.literal("tag"), tag }),
      object({ type: z.literal("hasPrefix"), prefix }),
      object({
        type: z.literal("duration"),
        op: z.enum(["gte", "lte"]),
        sec: z.number().int().nonnegative(),
      }),
      object({ type: z.literal("bookmarked") }),
      object({ type: z.literal("played"), withinDays: positiveInt.optional() }),
      object({ type: z.literal("added"), withinDays: positiveInt }),
      object({ type: z.literal("addedYear"), year: z.string().regex(YEAR_VALUE_PATTERN) }),
      object({ type: z.literal("hasError") }),
      object({ type: z.literal("text"), q }),
    ]),
  );
  return node;
}

/** DB 読み出し用。木として読めるかだけを見る（保存できる形・正規形は要求しない） */
export const conditionTreeSchema: z.ZodType<Condition> = treeSchema(
  z.object,
  z.string(),
  z.string(),
  z.string(),
);

const writeTreeSchema = treeSchema(
  z.strictObject,
  tagSchema,
  prefixSchema,
  z.string().trim().min(1),
);

/** 構造の一致判定用キー。オブジェクトのキー順を無視する */
export function conditionKey(condition: Condition): string {
  return JSON.stringify(sortKeys(condition));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => [k, sortKeys(v)]),
    );
  }
  return value;
}

function dedupe(children: Condition[]): Condition[] {
  const seen = new Set<string>();
  return children.filter((child) => {
    const key = conditionKey(child);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeTagPredicate(predicate: Predicate): Predicate {
  if (predicate.type !== "tag") return predicate;
  const tag = normalizeTag(predicate.tag);
  if (tag === null) throw new Error(`正規化できないタグです: ${JSON.stringify(predicate.tag)}`);
  return { type: "tag", tag };
}

function normalizeRootChild(child: Condition): Condition {
  if (child.type === "not") return { type: "not", child: normalizeRootChild(child.child) };
  if (child.type !== "or") return isPredicate(child) ? normalizeTagPredicate(child) : child;
  const children = dedupe(child.children.map(normalizeRootChild));
  return children.length === 1 ? children[0]! : { type: "or", children };
}

/** 保存できる形の木を正規形にする。ルートの and は畳まない。保存できる形であることが前提 */
export function normalizeCondition(condition: Condition): Condition {
  if (condition.type !== "and") return condition;
  return { type: "and", children: dedupe(condition.children.map(normalizeRootChild)) };
}

/** 保存できる形の検証。違反の説明を返す（なければ null） */
export function savedConditionViolation(condition: Condition): string | null {
  if (condition.type !== "and") return "条件のルートは and にしてください";
  for (const child of condition.children) {
    const violation = rootChildViolation(child);
    if (violation) return violation;
  }
  return null;
}

function rootChildViolation(child: Condition): string | null {
  const inner = child.type === "not" ? child.child : child;
  if (inner.type === "or") {
    if (inner.children.length === 0) return "子の無い or は保存できません";
    return inner.children.every(isPredicate) ? null : "or の中には述語だけを置けます";
  }
  return isPredicate(inner) ? null : "入れ子は1段までです";
}

/** 保存用。木として読めて、保存できる形で、正規化済みの条件だけを返す */
export const conditionSchema: z.ZodType<Condition, unknown> = writeTreeSchema.transform(
  (tree, ctx) => {
    const violation = savedConditionViolation(tree);
    if (violation) {
      ctx.addIssue({ code: "custom", message: violation });
      return z.NEVER;
    }
    return normalizeCondition(tree);
  },
);

export const EMPTY_CONDITION: Condition = { type: "and", children: [] };

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

/** 検索語の正規形（前後の空白を落とす）。空なら絞り込みに効かない。保存スキーマの text と同じ規則 */
export function normalizeSearchQuery(q: string | undefined): string {
  return q?.trim() ?? "";
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

// ── 条件の形の判定（正規化済みの木が前提） ─────────────────────

export function rootChildren(condition: Condition): Condition[] {
  return condition.type === "and" ? condition.children : [];
}

/** 条件が空（全作品） */
export function isEmptyCondition(condition: Condition): boolean {
  return condition.type === "and" && condition.children.length === 0;
}

function isSinglePredicate(condition: Condition, type: PredicateType): boolean {
  const children = rootChildren(condition);
  return children.length === 1 && children[0]!.type === type;
}

/** ルートの子が bookmarked だけ（お気に入りの案内を出す） */
export function isBookmarkedOnly(condition: Condition): boolean {
  return isSinglePredicate(condition, "bookmarked");
}

/** ルートの子が hasError だけ（エラーの一括解除バナー・0件で隠す・要対応からの導線） */
export function isHasErrorOnly(condition: Condition): boolean {
  return isSinglePredicate(condition, "hasError");
}

/** 条件の木のどこかに bookmarked がある（お気に入りの切り替えで所属が変わりうる） */
export function usesBookmarked(condition: Condition): boolean {
  switch (condition.type) {
    case "bookmarked":
      return true;
    case "and":
    case "or":
      return condition.children.some(usesBookmarked);
    case "not":
      return usesBookmarked(condition.child);
    default:
      return false;
  }
}
