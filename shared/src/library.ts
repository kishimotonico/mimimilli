// ライブラリ（検索・分類軸・スマートフォルダー・検索プリセット）の契約。
import { z } from "zod";

const utf8Encoder = new TextEncoder();

/** SQLiteのBINARY照合と同じUTF-8バイト順で文字列を比較する。 */
export function compareUtf8Bytes(a: string, b: string): number {
  const aBytes = utf8Encoder.encode(a);
  const bBytes = utf8Encoder.encode(b);
  const length = Math.min(aBytes.length, bBytes.length);
  for (let index = 0; index < length; index++) {
    const difference = aBytes[index]! - bBytes[index]!;
    if (difference !== 0) return difference;
  }
  return aBytes.length - bBytes.length;
}

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
 *  - "tag": 全タグ軸（組み込み）。flat・annotated 双方を集計する
 *    （ADR-0005 追記: prefixグループ見出し付きチェックボックス一覧で表示）
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
export const axisFacetListSchema = z.array(axisFacetItemSchema);

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
export const smartFolderListSchema = z.array(smartFolderSchema);

export const smartFolderCreateSchema = z.object({
  name: z.string().min(1),
  rules: z.array(smartFolderRuleSchema).default([]),
  sort: sortIdSchema.default("added-desc"),
});
export type SmartFolderCreate = z.infer<typeof smartFolderCreateSchema>;

export const smartFolderUpdateSchema = z
  .object({
    name: z.string().min(1).optional(),
    rules: z.array(smartFolderRuleSchema).optional(),
    sort: sortIdSchema.optional(),
  })
  .refine(
    (patch) => patch.name !== undefined || patch.rules !== undefined || patch.sort !== undefined,
  );
export type SmartFolderUpdate = z.infer<typeof smartFolderUpdateSchema>;
