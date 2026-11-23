// スマートフォルダーの条件の木（ADR-0040）。保存できる形の検証・正規化・形の判定を持つ。
// 評価（createMatcher / compileCondition）は server 側の責務でここには置かない。
import { z } from "zod";
import { YEAR_VALUE_PATTERN } from "./pseudoTag.ts";
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

const writeTreeSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.strictObject({ type: z.literal("and"), children: z.array(writeTreeSchema) }),
    z.strictObject({ type: z.literal("or"), children: z.array(writeTreeSchema) }),
    z.strictObject({ type: z.literal("not"), child: writeTreeSchema }),
    z.strictObject({ type: z.literal("tag"), tag: tagSchema }),
    z.strictObject({ type: z.literal("hasPrefix"), prefix: prefixSchema }),
    z.strictObject({
      type: z.literal("duration"),
      op: z.enum(["gte", "lte"]),
      sec: z.number().int().nonnegative(),
    }),
    z.strictObject({ type: z.literal("bookmarked") }),
    z.strictObject({ type: z.literal("played"), withinDays: positiveInt.optional() }),
    z.strictObject({ type: z.literal("added"), withinDays: positiveInt }),
    z.strictObject({ type: z.literal("addedYear"), year: z.string().regex(YEAR_VALUE_PATTERN) }),
    z.strictObject({ type: z.literal("hasError") }),
    z.strictObject({ type: z.literal("text"), q: z.string().trim().min(1) }),
  ]),
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

/** 1つの and・or の子の上限。SQL は子を平坦につなぐので、SQLite の式の深さの上限に届く木を保存させない */
export const MAX_CONDITION_CHILDREN = 100;

/** 保存できる木の深さ（and → not → or → 述語）。これより深い入れ子は、再帰に入る前に弾く */
const MAX_TREE_DEPTH = 4;

function withinMaxDepth(raw: unknown): boolean {
  const stack: Array<{ node: unknown; depth: number }> = [{ node: raw, depth: 1 }];
  for (let item = stack.pop(); item !== undefined; item = stack.pop()) {
    const { node, depth } = item;
    if (node === null || typeof node !== "object") continue;
    if (depth > MAX_TREE_DEPTH) return false;
    const { children, child } = node as { children?: unknown; child?: unknown };
    if (Array.isArray(children))
      for (const c of children) stack.push({ node: c, depth: depth + 1 });
    if (child !== undefined) stack.push({ node: child, depth: depth + 1 });
  }
  return true;
}

/** 保存できる形の検証。違反の説明を返す（なければ null） */
export function savedConditionViolation(condition: Condition): string | null {
  if (condition.type !== "and") return "条件のルートは and にしてください";
  if (condition.children.length > MAX_CONDITION_CHILDREN) {
    return `条件は${MAX_CONDITION_CHILDREN}個までです`;
  }
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
    if (inner.children.length > MAX_CONDITION_CHILDREN) {
      return `or の子は${MAX_CONDITION_CHILDREN}個までです`;
    }
    return inner.children.every(isPredicate) ? null : "or の中には述語だけを置けます";
  }
  return isPredicate(inner) ? null : "入れ子は1段までです";
}

/** 保存と読み出しの両方で使う。木として読めて、保存できる形で、正規化済みの条件だけを返す */
export const conditionSchema: z.ZodType<Condition, unknown> = z
  .unknown()
  .superRefine((raw, ctx) => {
    if (!withinMaxDepth(raw)) ctx.addIssue({ code: "custom", message: "入れ子は1段までです" });
  })
  .pipe(writeTreeSchema)
  .transform((tree, ctx) => {
    const violation = savedConditionViolation(tree);
    if (violation) {
      ctx.addIssue({ code: "custom", message: violation });
      return z.NEVER;
    }
    return normalizeCondition(tree);
  });

export const EMPTY_CONDITION: Condition = { type: "and", children: [] };

/** 検索語の正規形（前後の空白を落とす）。空なら絞り込みに効かない。保存スキーマの text と同じ規則 */
export function normalizeSearchQuery(q: string | undefined): string {
  return q?.trim() ?? "";
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
