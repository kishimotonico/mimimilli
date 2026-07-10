// エンドポイント横断の契約: 作品検索クエリ、ページングエンベロープ、部分更新、エラー形式。
import { z } from "zod";
import { facetAxisIdSchema, sortIdSchema, viewIdSchema } from "./library.ts";
import { normalizeTags, workSummarySchema } from "./work.ts";

// ── 作品検索（GET /api/works）────────────────────────────────

/** クエリパラメータ。tags はカンマ区切り文字列で受け、配列へ変換する */
export const worksQuerySchema = z.object({
  q: z.string().default(""),
  tags: z
    .string()
    .default("")
    .transform((s) => s.split(",").filter(Boolean)),
  tagOp: z.enum(["AND", "OR"]).default("AND"),
  axis: facetAxisIdSchema.optional(),
  axisValue: z.string().optional(),
  view: viewIdSchema.optional(),
  sort: sortIdSchema.default("added-desc"),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type WorksQuery = z.infer<typeof worksQuerySchema>;

/** ページングエンベロープ。page/limit 未指定時は全件を items に返す（total = items.length） */
export const worksPageSchema = z.object({
  items: z.array(workSummarySchema),
  total: z.number().int().nonnegative(),
});
export type WorksPage = z.infer<typeof worksPageSchema>;

// ── 作品の部分更新（PATCH /api/works/:id）────────────────────
// 旧 PUT /works/:id/tags・PUT /works/:id/title・POST /works/:id/bookmark を統合。

export const workPatchSchema = z.object({
  title: z.string().min(1).optional(),
  /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5。prefix 小文字化・trim・重複排除） */
  tags: z.array(z.string()).transform(normalizeTags).optional(),
  bookmarked: z.boolean().optional(),
});
export type WorkPatch = z.infer<typeof workPatchSchema>;

/** POST /api/works/:id/resume（高頻度更新のため PATCH と分離） */
export const resumeBodySchema = z.object({
  position: z.number().nonnegative(),
  trackIndex: z.number().int().nonnegative(),
});
export type ResumeBody = z.infer<typeof resumeBodySchema>;

// ── カバー画像サムネイル（GET /api/media/cover/:id?w=）───────
// キャッシュを有界にするため、許可する幅は離散値のみ。未対応の幅はリクエストされても
// normalizeThumbnailWidth() が最近傍の許可幅へ丸める（丸め方の挙動はテストで担保する）。

export const THUMBNAIL_WIDTHS = [128, 256, 512] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

export function normalizeThumbnailWidth(width: number): ThumbnailWidth {
  return THUMBNAIL_WIDTHS.reduce((closest, candidate) =>
    Math.abs(candidate - width) < Math.abs(closest - width) ? candidate : closest,
  );
}

export const coverQuerySchema = z.object({
  w: z.coerce.number().int().positive().optional(),
});
export type CoverQuery = z.infer<typeof coverQuerySchema>;

// ── エクスポート（POST /api/export）──────────────────────────

export const exportResponseSchema = z.object({
  /** ライブラリ全体の JSON 文字列 */
  data: z.string(),
});
export type ExportResponse = z.infer<typeof exportResponseSchema>;

// ── エラー形式 ───────────────────────────────────────────────
// 4xx/5xx は常にこの形で返す。ステータスコードと code の対応:
//   404 not_found / 400 invalid_request / 409 conflict / 500 internal

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(["not_found", "invalid_request", "conflict", "internal"]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
