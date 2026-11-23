// スマートフォルダー（ADR-0040）: 条件・グループ分け・保存形・HTTP の契約・既定テンプレート。
import { z } from "zod";
import { tagFiltersQuerySchema } from "./api.ts";
import {
  conditionSchema,
  isEmptyCondition,
  isHasErrorOnly,
  prefixSchema,
  savedConditionViolation,
  type Condition,
} from "./condition.ts";
import {
  groupSortIdSchema,
  MAX_RANDOM_SEED,
  sortIdSchema,
  type GroupSortId,
  type SortId,
} from "./library.ts";
import { scanRecordKindSchema, workChangeKindSchema } from "./scan.ts";

// ── グループ分け ─────────────────────────────────────────────

export const groupBySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("prefix"), prefix: prefixSchema }),
  z.object({ kind: z.literal("tag") }),
  z.object({ kind: z.literal("addedYear") }),
]);
export type GroupBy = z.infer<typeof groupBySchema>;

/** グループ分けを付けたときの値の並びの初期値。追加年は新しい年が先、それ以外は件数の多い順 */
export function defaultGroupSort(groupBy: GroupBy): GroupSortId {
  return groupBy.kind === "addedYear" ? "name-desc" : "count-desc";
}

// ── 保存形 ───────────────────────────────────────────────────

const smartFolderNameSchema = z.string().trim().min(1);

/** URL のパスに入るので、形式だけを検査する */
const smartFolderIdSchema = z
  .string()
  .regex(/^[a-z0-9-]{1,64}$/, { message: "ID は半角小文字・数字・ハイフンの64文字までです" });

const definitionShape = {
  name: smartFolderNameSchema,
  /** 保存できる形だけを通し、正規化して返す */
  condition: conditionSchema,
  /** 値を選んだ後（グループ分けなしは全体）の作品一覧の並び。null は「『すべて』と同じ」 */
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
  /** 値一覧の並び。グループ分けがあるときだけ必須で、「すべて」からの継承は無い */
  groupSort: groupSortIdSchema.nullable(),
};

/** POST /smart-folders のボディ。通常の作成・既定から追加・削除の取り消しのすべてがこの形を通る。
 *  id を省くと採番して末尾に入れ、position を渡すとその位置に入れて後ろをずらす */
export const smartFolderCreateSchema = z.strictObject({
  ...definitionShape,
  id: smartFolderIdSchema.optional(),
  position: z.number().int().nonnegative().optional(),
});
export type SmartFolderCreate = z.infer<typeof smartFolderCreateSchema>;

/** 画面で編集する定義（ID と位置を除いた列） */
export type SmartFolderWrite = Omit<SmartFolderCreate, "id" | "position">;

/** PATCH /smart-folders/:id のボディ。送った列だけを更新する */
export const smartFolderPatchSchema = z
  .strictObject(definitionShape)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { message: "更新する項目がありません" });
export type SmartFolderPatch = z.infer<typeof smartFolderPatchSchema>;

/** 一覧の1行。保存と同じ検証を通った行だけが載る。sort の null は「『すべて』と同じ」 */
export const smartFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: conditionSchema,
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
  groupSort: groupSortIdSchema.nullable(),
  position: z.number().int().nonnegative(),
  createdAt: z.string(),
  /** 件数を出す・0件で隠すかの判定に要るものだけ数える。それ以外は null */
  count: z.number().int().nonnegative().nullable(),
});
export type SmartFolder = z.infer<typeof smartFolderSchema>;

export const smartFolderListSchema = z.array(smartFolderSchema);

export const smartFolderOrderSchema = z.strictObject({
  ids: z
    .array(z.string())
    .refine((ids) => new Set(ids).size === ids.length, { message: "ID が重複しています" }),
});
export type SmartFolderOrder = z.infer<typeof smartFolderOrderSchema>;

export type SmartFolderRowFields = Pick<
  SmartFolderCreate,
  "name" | "condition" | "sort" | "groupBy" | "groupSort"
> & { id: string };

export interface SmartFolderViolation {
  /** 違反した列 */
  field: "name" | "condition" | "sort" | "groupBy" | "groupSort";
  message: string;
}

/** 作成・更新・読み出しのいずれも、できあがる行をこの1関数で検証する。見るのはデータの不変条件だけ */
export function smartFolderViolation(row: SmartFolderRowFields): SmartFolderViolation | null {
  const condition = savedConditionViolation(row.condition);
  if (condition) return { field: "condition", message: condition };
  if (row.groupBy !== null && row.groupSort === null) {
    return { field: "groupSort", message: "グループ分けには値の並びが要ります" };
  }
  if (row.groupBy === null && row.groupSort !== null) {
    return { field: "groupSort", message: "値の並びはグループ分けがあるときだけ指定します" };
  }
  if (row.id === ALL_SMART_FOLDER_ID) {
    const all = `「${ALL_SMART_FOLDER_NAME}」`;
    if (row.name !== ALL_SMART_FOLDER_NAME) {
      return { field: "name", message: `${all}の名前は変えられません` };
    }
    if (!isEmptyCondition(row.condition)) {
      return { field: "condition", message: `${all}の条件は空のままにしてください` };
    }
    if (row.groupBy !== null) {
      return { field: "groupBy", message: `${all}にグループ分けは付けられません` };
    }
    if (row.sort === null) {
      return { field: "sort", message: `${all}の既定の並びは空にできません` };
    }
  }
  return null;
}

// ── 作品一覧・値一覧の要求 ────────────────────────────────────

/** GET /:id/works。チップは常に AND（契約にないキーは受け付けない）。sort は必須で、random には seed が要る */
export const smartFolderWorksRequestSchema = z
  .strictObject({
    q: z.string().default(""),
    tags: tagFiltersQuerySchema,
    /** グループ分けの選択中の値 */
    group: z.string().min(1).optional(),
    sort: sortIdSchema,
    seed: z.coerce.number().int().min(0).max(MAX_RANDOM_SEED).optional(),
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
  /** 返す値の並び */
  groupSort: groupSortIdSchema,
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
export const ALL_SMART_FOLDER_NAME = "すべて";

export interface SmartFolderTemplate {
  id: string;
  name: string;
  condition: Condition;
  /** null は「『すべて』と同じ」 */
  sort: SortId | null;
  groupBy: GroupBy | null;
  /** グループ分けがあるテンプレートだけ持つ */
  groupSort: GroupSortId | null;
  /** 初回起動時に投入する */
  seeded: boolean;
}

const and = (...children: Condition[]): Condition => ({ type: "and", children });
const grouped = (
  id: string,
  name: string,
  groupBy: GroupBy,
  options: { seeded?: boolean; sort?: SortId } = {},
): SmartFolderTemplate => ({
  id,
  name,
  condition: and(),
  sort: options.sort ?? null,
  groupBy,
  groupSort: defaultGroupSort(groupBy),
  seeded: options.seeded ?? true,
});

export const SMART_FOLDER_TEMPLATES: readonly SmartFolderTemplate[] = [
  {
    id: ALL_SMART_FOLDER_ID,
    name: ALL_SMART_FOLDER_NAME,
    condition: and(),
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "random",
    name: "ランダム",
    condition: and(),
    sort: "random",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "recent",
    name: "最近再生",
    condition: and({ type: "played" }),
    sort: "last-played",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "added",
    name: "最近追加",
    condition: and({ type: "added", withinDays: 30 }),
    sort: "added-desc",
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "fav",
    name: "お気に入り",
    condition: and({ type: "bookmarked" }),
    sort: null,
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  {
    id: "error",
    name: "エラー",
    condition: and({ type: "hasError" }),
    sort: null,
    groupBy: null,
    groupSort: null,
    seeded: true,
  },
  grouped("by-cv", "CV別", { kind: "prefix", prefix: "cv" }),
  grouped("by-circle", "サークル別", { kind: "prefix", prefix: "サークル" }),
  grouped("by-category", "カテゴリ別", { kind: "prefix", prefix: "カテゴリ" }),
  grouped("by-tag", "タグ別", { kind: "tag" }),
  grouped("by-year", "追加年別", { kind: "addedYear" }),
  grouped(
    "by-series",
    "シリーズ別",
    { kind: "prefix", prefix: "シリーズ" },
    { seeded: false, sort: "title-asc" },
  ),
  grouped("by-rating", "レーティング別", { kind: "prefix", prefix: "rating" }, { seeded: false }),
];

export function findSmartFolderTemplate(id: string): SmartFolderTemplate | undefined {
  return SMART_FOLDER_TEMPLATES.find((template) => template.id === id);
}

// ── 編集の権限 ───────────────────────────────────────────────

/** client の UI の出し分け。サーバーが守るのは smartFolderViolation の不変条件だけで、権限では弾かない */
export interface SmartFolderPermissions {
  rename: boolean;
  editCondition: boolean;
  editGroupBy: boolean;
  /** 既定の並びを「『すべて』と同じ」（null）にできるか */
  inheritSort: boolean;
  remove: boolean;
}

export function smartFolderPermissions(folder: Pick<SmartFolder, "id">): SmartFolderPermissions {
  const isAll = folder.id === ALL_SMART_FOLDER_ID;
  const isTemplate = findSmartFolderTemplate(folder.id) !== undefined;
  return {
    rename: !isAll,
    editCondition: !isTemplate,
    editGroupBy: !isTemplate,
    inheritSort: !isAll,
    remove: !isAll,
  };
}
