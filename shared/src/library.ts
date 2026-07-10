// ライブラリ（検索・分類軸・スマートフォルダー・検索プリセット）の契約。
import { z } from "zod";

// ── ソート ───────────────────────────────────────────────────

export const sortIdSchema = z.enum([
  "added-desc",
  "added-asc",
  "title-asc",
  "title-desc",
  "duration-desc",
  "duration-asc",
  "last-played",
  "random",
  "id-asc",
]);
export type SortId = z.infer<typeof sortIdSchema>;

// ── ビュー・分類軸 ────────────────────────────────────────────

/** 軸レールのビュー（単純ビュー） */
export const viewIdSchema = z.enum(["all", "recent", "added", "fav", "unplayed", "missing"]);
export type ViewId = z.infer<typeof viewIdSchema>;

/** 分類軸の ID（ADR-0005）。enum ではなく文字列:
 *  - "tag": フラットタグ軸（組み込み）
 *  - "year": 追加日の年（組み込み。addedAt 由来でタグではない）
 *  - それ以外: 登録済み prefix そのもの（例: "cv", "サークル"）。正規形（小文字）で扱う */
export const facetAxisIdSchema = z
  .string()
  .trim()
  .min(1)
  .transform((s) => s.toLowerCase())
  .refine((s) => !s.includes("/"), { message: "軸IDにスラッシュは使えません" });
export type FacetAxisId = string;

export const axisFacetItemSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});
export type AxisFacetItem = z.infer<typeof axisFacetItemSchema>;

// ── スマートフォルダー ────────────────────────────────────────

const smartFolderConjunctionSchema = z.enum(["WHERE", "AND", "OR", "AND NOT"]);

export const smartFolderRuleSchema = z.discriminatedUnion("field", [
  z.object({
    conjunction: smartFolderConjunctionSchema,
    field: z.literal("タグ"),
    operator: z.literal("∋"),
    values: z.array(z.string().min(1)).min(1),
  }),
  z.object({
    conjunction: z.enum(["WHERE", "AND", "OR"]),
    field: z.literal("長さ"),
    operator: z.literal("≥"),
    values: z.array(z.string().regex(/^\d+$/)).length(1),
  }),
]);
export type SmartFolderRule = z.infer<typeof smartFolderRuleSchema>;

export const smartFolderSchema = z.object({
  id: z.string(),
  name: z.string(),
  rules: z.array(smartFolderRuleSchema),
  sort: sortIdSchema,
  createdAt: z.string(),
});
export type SmartFolder = z.infer<typeof smartFolderSchema>;

export const smartFolderCreateSchema = z.object({
  name: z.string().min(1),
  rules: z.array(smartFolderRuleSchema).default([]),
  sort: sortIdSchema.default("added-desc"),
});
export type SmartFolderCreate = z.infer<typeof smartFolderCreateSchema>;

export const smartFolderUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  rules: z.array(smartFolderRuleSchema).optional(),
  sort: sortIdSchema.optional(),
});
export type SmartFolderUpdate = z.infer<typeof smartFolderUpdateSchema>;

// ── 検索プリセット ────────────────────────────────────────────

export const searchPresetSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  query: z.string(),
  tagFilters: z.array(z.string()),
  sortId: sortIdSchema,
});
export type SearchPreset = z.infer<typeof searchPresetSchema>;

export const searchPresetCreateSchema = z.object({
  name: z.string().min(1),
  query: z.string().default(""),
  tagFilters: z.array(z.string()).default([]),
  sortId: sortIdSchema.default("added-desc"),
});
export type SearchPresetCreate = z.infer<typeof searchPresetCreateSchema>;
