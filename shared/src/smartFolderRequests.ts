// /smart-folders 以下の要求スキーマ（ADR-0040「HTTP の契約」）。client と server が同じ型を通す。
import { z } from "zod";
import { tagFiltersQuerySchema } from "./api.ts";
import { parseGroupByKey } from "./groupFilter.ts";
import { groupSortIdSchema, MAX_RANDOM_SEED, sortIdSchema } from "./library.ts";
import { scanRecordKindSchema, workChangeKindSchema } from "./scan.ts";
import { definitionShape, smartFolderIdSchema } from "./smartFolder.ts";

/** POST /smart-folders のボディ。通常の作成・既定から追加・削除の取り消しのすべてがこの形を通る。
 *  id を省くと採番して末尾に入れ、position を渡すとその位置に入れて後ろをずらす */
export const smartFolderCreateSchema = z.strictObject({
  ...definitionShape,
  id: smartFolderIdSchema.optional(),
  position: z.number().int().nonnegative().optional(),
});
export type SmartFolderCreate = z.infer<typeof smartFolderCreateSchema>;

/** PATCH /smart-folders/:id のボディ。送った列だけを更新する */
export const smartFolderPatchSchema = z
  .strictObject(definitionShape)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "更新する項目がありません",
  });
export type SmartFolderPatch = z.infer<typeof smartFolderPatchSchema>;

export const smartFolderOrderSchema = z.strictObject({
  ids: z.array(z.string()).refine((ids) => new Set(ids).size === ids.length, {
    message: "ID が重複しています",
  }),
});
export type SmartFolderOrder = z.infer<typeof smartFolderOrderSchema>;

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

const groupByQuerySchema = z.string().transform((key, ctx) => {
  const groupBy = parseGroupByKey(key);
  if (groupBy === null) {
    ctx.addIssue({ code: "custom", message: "groupBy が不正です" });
    return z.NEVER;
  }
  return groupBy;
});

/** GET /:id/groups。そのフォルダー自身の値一覧と、任意の groupBy での候補の両方に使う。
 *  値一覧では tags・q・group を送らない */
export const smartFolderGroupsRequestSchema = z.strictObject({
  groupBy: groupByQuerySchema,
  /** 返す値の並び。サーバーは既定を補わない */
  groupSort: groupSortIdSchema,
  group: z.string().min(1).optional(),
  tags: tagFiltersQuerySchema,
  q: z.string().default(""),
});
export type SmartFolderGroupsRequest = z.infer<typeof smartFolderGroupsRequestSchema>;
