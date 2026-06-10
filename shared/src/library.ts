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

/** 分類軸（ファセット集計の対象） */
export const facetAxisSchema = z.enum(["circle", "cv", "series", "cat", "tag", "year"]);
export type FacetAxis = z.infer<typeof facetAxisSchema>;

/** 分類軸 → Annotated タグのプレフィックス（前方一致用。tag / year は対象外） */
export const AXIS_TAG_PREFIX: Partial<Record<FacetAxis, string>> = {
  circle: "サークル/",
  cv: "cv/",
  series: "シリーズ/",
  cat: "カテゴリ/",
};

export const axisFacetItemSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
});
export type AxisFacetItem = z.infer<typeof axisFacetItemSchema>;

// ── スマートフォルダー ────────────────────────────────────────

export const smartFolderRuleSchema = z.object({
  conjunction: z.enum(["WHERE", "AND", "AND NOT"]),
  field: z.string(),
  operator: z.string(),
  values: z.array(z.string()),
});
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
