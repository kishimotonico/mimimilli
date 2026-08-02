// エンドポイント横断の契約: 作品検索クエリ、ページングエンベロープ、部分更新、エラー形式。
import { z } from "zod";
import { facetAxisIdSchema, sortIdSchema, viewIdSchema } from "./library.ts";
import { normalizeTags, resumeSchema, workListItemSchema, workSchema } from "./work.ts";
import { dlsiteApplyBodySchema, dlsiteStatusSchema } from "./dlsite.ts";

// ── 作品検索（GET /api/works）────────────────────────────────

/** GET /works のページサイズ。limit 未指定時にサーバー側で適用するデフォルト（TASK-73）。
 *  client の追加読み込みも同じサイズでページを要求する */
export const WORKS_DEFAULT_PAGE_SIZE = 200;

/** クエリパラメータ。tags は同名パラメータを繰り返して配列で受ける */
export const worksQuerySchema = z.object({
  q: z.string().default(""),
  tags: z.array(z.string()).default([]),
  tagOp: z.enum(["AND", "OR"]).default("AND"),
  axis: facetAxisIdSchema.optional(),
  axisValue: z.string().optional(),
  view: viewIdSchema.optional(),
  sort: sortIdSchema.default("added-desc"),
  /** randomソートの安定順序を決める。省略時はアダプタが発行してレスポンスで返す。 */
  seed: z.coerce.number().int().min(0).max(0x7fffffff).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
/** HTTP クエリの入力型（.default 付きフィールドは省略可能） */
export type WorksQueryInput = z.input<typeof worksQuerySchema>;
/** パース後の正規化済みクエリ（サーバー adapter が受け取る型） */
export type WorksQuery = z.output<typeof worksQuerySchema>;

/** 検索・フィルター後・ページング前の集合に対する集計。件数は total 側で持つため含まない。
 *  durationSec は totalDurationSec が未知（null）の作品を除いた合計。 */
export const collectionStatsSchema = z.object({
  trackCount: z.number().int().nonnegative(),
  durationSec: z.number().nonnegative(),
});
export type CollectionStats = z.infer<typeof collectionStatsSchema>;

/** ページングエンベロープ。total は検索・フィルター後・ページング前の件数。
 *  サーバーは page/limit 未指定でもデフォルト（page=1, limit=WORKS_DEFAULT_PAGE_SIZE）でページングする */
export const worksPageSchema = z.object({
  items: z.array(workListItemSchema),
  total: z.number().int().nonnegative(),
  stats: collectionStatsSchema,
  seed: z.number().int().min(0).max(0x7fffffff).optional(),
});
export type WorksPage = z.infer<typeof worksPageSchema>;

/** GET /api/smart-folders/:id/works のクエリパラメータ。
 *  ソートはフォルダー自身が保持するため、page/limit/seed のみを受け取る */
export const smartFolderWorksQuerySchema = worksQuerySchema.pick({
  page: true,
  limit: true,
  seed: true,
});
export type SmartFolderWorksQuery = z.infer<typeof smartFolderWorksQuerySchema>;

// ── DLsite 通知 ─────────────────────────────────────────────

/** 通知ベルが表示するDLsite状態の集計。通常の作品一覧とは独立して取得する。 */
export const dlsiteNotificationSummarySchema = z.object({
  rjCodeMissingCount: z.number().int().nonnegative(),
  fetchFailedCount: z.number().int().nonnegative(),
  parseErrorCount: z.number().int().nonnegative(),
  parseErrorAlert: z.boolean(),
  unlinkedCount: z.number().int().nonnegative(),
});
export type DlsiteNotificationSummary = z.infer<typeof dlsiteNotificationSummarySchema>;

export const dlsiteNotificationKindSchema = z.enum(["rj-missing", "fetch-failed", "parse-failed"]);
export type DlsiteNotificationKind = z.infer<typeof dlsiteNotificationKindSchema>;

/** DLsite通知モーダルの最小行DTO。parse-failed 以外は rjCode は null。 */
export const dlsiteNotificationItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: dlsiteStatusSchema,
  rjCode: z.string().nullable(),
});
export type DlsiteNotificationItem = z.infer<typeof dlsiteNotificationItemSchema>;

export const dlsiteNotificationPageSchema = z.object({
  items: z.array(dlsiteNotificationItemSchema),
  total: z.number().int().nonnegative(),
});
export type DlsiteNotificationPage = z.infer<typeof dlsiteNotificationPageSchema>;

export const dlsiteNotificationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});
export type DlsiteNotificationQuery = z.infer<typeof dlsiteNotificationQuerySchema>;

/** GET /api/tags */
export const tagListSchema = z.array(z.string());

// ── 作品の部分更新（PATCH /api/works/:id）────────────────────
// 旧 PUT /works/:id/tags・PUT /works/:id/title・POST /works/:id/bookmark を統合。

export const workPatchSchema = z
  .object({
    title: z.string().min(1).optional(),
    /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5。prefix 小文字化・trim・重複排除） */
    tags: z.array(z.string()).transform(normalizeTags).optional(),
    bookmarked: z.boolean().optional(),
  })
  .refine(
    (patch) =>
      patch.title !== undefined || patch.tags !== undefined || patch.bookmarked !== undefined,
  );
export type WorkPatch = z.infer<typeof workPatchSchema>;

// ── 作品の手動登録（POST /api/works, GET /api/works/register-preview）────

export const workRegisterPreviewQuerySchema = z.object({
  path: z.string().min(1),
});
export type WorkRegisterPreviewQuery = z.infer<typeof workRegisterPreviewQuerySchema>;

export const workRegisterPreviewSchema = z.object({
  suggestedTitle: z.string(),
  /** 孤立メタ復元時のみメタのタグを返す。通常登録時は常に空配列 */
  tags: z.array(z.string()),
  detectedRjCode: z.string().nullable(),
  descendantWorkCount: z.number().int().nonnegative(),
  alreadyRegistered: z.boolean(),
  orphanedMeta: z.boolean(),
});
export type WorkRegisterPreview = z.infer<typeof workRegisterPreviewSchema>;

export const workCreateBodySchema = z.object({
  path: z.string().min(1),
  title: z.string().min(1),
  /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5） */
  tags: z.array(z.string()).default([]).transform(normalizeTags),
  mergeDescendantWorks: z.boolean().default(false),
  dlsite: dlsiteApplyBodySchema.optional(),
});
export type WorkCreateBody = z.infer<typeof workCreateBodySchema>;

export const dlsiteFetchByCodeBodySchema = z.object({
  rjCode: z
    .string()
    .trim()
    .regex(/^(RJ|VJ)\d{6,8}$/i, "RJ/VJコードはRJまたはVJに続く6〜8桁で入力してください")
    .transform((value) => value.toUpperCase()),
});
export type DlsiteFetchByCodeBody = z.infer<typeof dlsiteFetchByCodeBodySchema>;

/** POST /api/works のレスポンス */
export const workCreateResponseSchema = workSchema;
export type WorkCreateResponse = z.infer<typeof workCreateResponseSchema>;

/** POST /api/works/:id/resume（高頻度更新のため PATCH と分離） */
export const resumeBodySchema = resumeSchema;
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
    code: z.enum([
      "not_found",
      "parse_error",
      "offline",
      "error",
      "invalid_request",
      "conflict",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
