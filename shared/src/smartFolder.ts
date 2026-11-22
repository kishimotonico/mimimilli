// スマートフォルダー（ADR-0040）: 条件・グループ分け・保存形・HTTP の契約・既定テンプレート。
import { z } from "zod";
import { tagFiltersQuerySchema } from "./api.ts";
import {
  conditionSchema,
  conditionTreeSchema,
  isEmptyCondition,
  isHasErrorOnly,
  prefixSchema,
  type Condition,
} from "./condition.ts";
import { sortIdSchema, type SortId } from "./library.ts";
import { scanRecordKindSchema, workChangeKindSchema } from "./scan.ts";

// ── グループ分け ─────────────────────────────────────────────

export const groupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prefix"), prefix: prefixSchema }),
  z.object({ kind: z.literal("tag") }),
  z.object({ kind: z.literal("addedYear") }),
]);
export type GroupBy = z.infer<typeof groupBySchema>;

// ── 保存形 ───────────────────────────────────────────────────

const smartFolderNameSchema = z.string().trim().min(1);

/** POST・PUT のボディ。条件は保存できる形だけを通し、正規化して返す */
export const smartFolderWriteSchema = z.strictObject({
  name: smartFolderNameSchema,
  condition: conditionSchema,
  /** null は「『すべて』と同じ」 */
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
});
export type SmartFolderWrite = z.infer<typeof smartFolderWriteSchema>;

/** 一覧の1行。condition・sort・groupBy のどれか1つでも読めない行は壊れた行で、3つとも null で返す。
 *  壊れた行は削除と作り直しだけができる。正常な行の sort の null は「『すべて』と同じ」 */
export const smartFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: conditionTreeSchema.nullable(),
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  /** 件数を出す・0件で隠すかの判定に要るものだけ数える。それ以外は null */
  count: z.number().int().nonnegative().nullable(),
});
export type SmartFolder = z.infer<typeof smartFolderSchema>;
export type BrokenSmartFolder = SmartFolder & { condition: null };
export type ReadableSmartFolder = SmartFolder & { condition: Condition };

export function isBrokenSmartFolder(item: SmartFolder): item is BrokenSmartFolder {
  return item.condition === null;
}

export const smartFolderListSchema = z.array(smartFolderSchema);

export const smartFolderOrderSchema = z.strictObject({
  ids: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length, { message: "ID が重複しています" }),
});
export type SmartFolderOrder = z.infer<typeof smartFolderOrderSchema>;

const USER_SMART_FOLDER_ID = /^sf-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const smartFolderRestoreSchema = z.strictObject({
  id: z
    .string()
    .refine(
      (id) =>
        USER_SMART_FOLDER_ID.test(id) ||
        (id !== ALL_SMART_FOLDER_ID && SMART_FOLDER_TEMPLATES.some((t) => t.id === id)),
      { message: "復元できない ID です" },
    ),
  name: smartFolderNameSchema,
  condition: conditionSchema,
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
  position: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});
export type SmartFolderRestore = z.infer<typeof smartFolderRestoreSchema>;

// ── 作品一覧・値一覧の要求 ────────────────────────────────────

/** GET /:id/works。チップは常に AND（契約にないキーは受け付けない）。sort は必須で、random には seed が要る */
export const smartFolderWorksRequestSchema = z
  .strictObject({
    q: z.string().default(""),
    tags: tagFiltersQuerySchema,
    /** グループ分けの選択中の値 */
    group: z.string().min(1).optional(),
    sort: sortIdSchema,
    seed: z.coerce.number().int().min(0).max(0x7fffffff).optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    scanRecord: scanRecordKindSchema.optional(),
    scanChange: workChangeKindSchema.optional(),
  })
  .refine((query) => query.sort !== "random" || query.seed !== undefined, {
    message: "sort=random には seed が必要です",
    path: ["seed"],
  });
export type SmartFolderWorksRequest = z.infer<typeof smartFolderWorksRequestSchema>;

/** POST /:id/groups。そのフォルダー自身の値一覧と、任意の groupBy での候補の両方に使う。
 *  値一覧では tags・q・group を送らない */
export const smartFolderGroupsRequestSchema = z.strictObject({
  groupBy: groupBySchema,
  group: z.string().min(1).optional(),
  tags: tagFiltersQuerySchema,
  q: z.string().default(""),
});
export type SmartFolderGroupsRequest = z.infer<typeof smartFolderGroupsRequestSchema>;

// ── 件数 ─────────────────────────────────────────────────────

type CountSubject = { condition: Condition; groupBy: GroupBy | null };

/** 0件のとき行を隠す候補か（条件が hasError だけ） */
export function isHiddenWhenEmpty(condition: Condition): boolean {
  return isHasErrorOnly(condition);
}

/** 画面に件数を出すか。条件が空のもの・グループ分けありは出さない */
export function showsCount(folder: CountSubject): boolean {
  return !isEmptyCondition(folder.condition) && folder.groupBy === null;
}

/** 件数を数える必要があるか。表示するもの、または 0件で隠すかの判定に要るもの */
export function needsCount(folder: CountSubject): boolean {
  return showsCount(folder) || isHiddenWhenEmpty(folder.condition);
}

// ── 既定テンプレート ─────────────────────────────────────────

export const ALL_SMART_FOLDER_ID = "all";

export interface SmartFolderTemplate {
  id: string;
  name: string;
  condition: Condition;
  /** null は「『すべて』と同じ」 */
  sort: SortId | null;
  groupBy: GroupBy | null;
  /** 初回起動時に投入する */
  seeded: boolean;
}

const and = (...children: Condition[]): Condition => ({ type: "and", children });
const grouped = (
  id: string,
  name: string,
  groupBy: GroupBy,
  seeded = true,
): SmartFolderTemplate => ({ id, name, condition: and(), sort: null, groupBy, seeded });

export const SMART_FOLDER_TEMPLATES: readonly SmartFolderTemplate[] = [
  { id: "all", name: "すべて", condition: and(), sort: "added-desc", groupBy: null, seeded: true },
  { id: "random", name: "ランダム", condition: and(), sort: "random", groupBy: null, seeded: true },
  {
    id: "recent",
    name: "最近再生",
    condition: and({ type: "played" }),
    sort: "last-played",
    groupBy: null,
    seeded: true,
  },
  {
    id: "added",
    name: "最近追加",
    condition: and({ type: "added", withinDays: 30 }),
    sort: "added-desc",
    groupBy: null,
    seeded: true,
  },
  {
    id: "fav",
    name: "お気に入り",
    condition: and({ type: "bookmarked" }),
    sort: null,
    groupBy: null,
    seeded: true,
  },
  {
    id: "error",
    name: "エラー",
    condition: and({ type: "hasError" }),
    sort: null,
    groupBy: null,
    seeded: true,
  },
  grouped("by-cv", "CV別", { kind: "prefix", prefix: "cv" }),
  grouped("by-circle", "サークル別", { kind: "prefix", prefix: "サークル" }),
  grouped("by-category", "カテゴリ別", { kind: "prefix", prefix: "カテゴリ" }),
  grouped("by-tag", "タグ別", { kind: "tag" }),
  grouped("by-year", "追加年別", { kind: "addedYear" }),
  grouped("by-series", "シリーズ別", { kind: "prefix", prefix: "シリーズ" }, false),
  grouped("by-rating", "レーティング別", { kind: "prefix", prefix: "rating" }, false),
];

export const smartFolderTemplateIdSchema = z.enum(
  SMART_FOLDER_TEMPLATES.map((t) => t.id) as [string, ...string[]],
);

/** POST /from-template */
export const smartFolderFromTemplateSchema = z.strictObject({
  templateId: smartFolderTemplateIdSchema,
});
export type SmartFolderFromTemplate = z.infer<typeof smartFolderFromTemplateSchema>;

export function findSmartFolderTemplate(id: string): SmartFolderTemplate | undefined {
  return SMART_FOLDER_TEMPLATES.find((template) => template.id === id);
}
