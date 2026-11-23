// スマートフォルダー（ADR-0040）: 保存形・行の検証・件数を出すかの判定。
// 既定テンプレートは smartFolderTemplates.ts、HTTP の要求スキーマは smartFolderRequests.ts。
import { z } from "zod";
import {
  conditionSchema,
  isEmptyCondition,
  isHasErrorOnly,
  savedConditionViolation,
  type Condition,
} from "./condition.ts";
import { groupBySchema, type GroupBy } from "./groupFilter.ts";
import { groupSortIdSchema, sortIdSchema } from "./library.ts";

// ── 保存形 ───────────────────────────────────────────────────

const smartFolderNameSchema = z.string().trim().min(1);

/** URL のパスに入るので、形式だけを検査する */
export const smartFolderIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/, {
  message: "ID は半角小文字・数字・ハイフンの64文字までです",
});

export const definitionShape = {
  name: smartFolderNameSchema,
  /** 保存できる形だけを通し、正規化して返す */
  condition: conditionSchema,
  /** 値を選んだ後（グループ分けなしは全体）の作品一覧の並び。null は「『すべて』と同じ」 */
  sort: sortIdSchema.nullable(),
  groupBy: groupBySchema.nullable(),
  /** 値一覧の並び。グループ分けがあるときだけ必須で、「すべて」からの継承は無い */
  groupSort: groupSortIdSchema.nullable(),
};

const smartFolderDefinitionSchema = z.object(definitionShape);

/** 画面で編集する定義（ID と位置を除いた列） */
export type SmartFolderWrite = z.infer<typeof smartFolderDefinitionSchema>;

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
});
export type SmartFolder = z.infer<typeof smartFolderSchema>;

export const smartFolderListSchema = z.array(smartFolderSchema);

/** GET /smart-folders/counts。件数を出す行だけが載り、キーは行の ID */
export const smartFolderCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type SmartFolderCounts = z.infer<typeof smartFolderCountsSchema>;

export type SmartFolderRowFields = SmartFolderWrite & { id: string };

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

// ── 「すべて」 ───────────────────────────────────────────────

export const ALL_SMART_FOLDER_ID = "all";
export const ALL_SMART_FOLDER_NAME = "すべて";
