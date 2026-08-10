// ライブラリ（検索・分類軸・スマートフォルダー・検索プリセット）の契約。
import { z } from "zod";
import { coverValueSchema } from "./cover.ts";
import { dedupeTags, normalizeTags, tagSchema } from "./work.ts";

export { compareUtf8Bytes } from "./text.ts";

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

/** 「最近追加」ビューの対象期間（日）。core と SQL の recent view 判定で共有する。 */
export const RECENT_VIEW_WINDOW_DAYS = 30;

/** random ソート用 seed。0x7fffffff 以下の非負整数。 */
export function createRandomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! & 0x7fffffff;
}

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

/** 値一覧の代表カバー1件。カバー画像配信（GET /media/cover/:id）が作品単位のルートしか
 *  持たないため、コラージュ描画に必要な workId を持たせる（coverValueSchema 単体には無い）。 */
export const axisFacetCoverSchema = coverValueSchema.extend({ workId: z.string() });
export type AxisFacetCover = z.infer<typeof axisFacetCoverSchema>;

export const axisFacetItemSchema = z.object({
  value: z.string(),
  count: z.number().int().nonnegative(),
  /** その値に属する全作品の再生時間合計（秒）。totalDurationSec が未知（null）の作品は合算から除く */
  durationSec: z.number().nonnegative(),
  /** 代表カバー。追加日時の新しい順で最大4件、cover未設定の作品は含まない */
  covers: z.array(axisFacetCoverSchema).max(4),
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
    // 作品側（workPatchSchema 等）と同じく正規形（prefix小文字化・trim・重複排除）で保存する
    values: z
      .array(tagSchema)
      .min(1)
      .transform((tags) => dedupeTags(normalizeTags(tags))),
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
