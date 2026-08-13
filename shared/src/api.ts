// エンドポイント横断の契約: 作品検索クエリ、ページングエンベロープ、部分更新、エラー形式。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
import { sortIdSchema, viewIdSchema } from "./library.ts";
import {
  dedupeTags,
  normalizeTags,
  resumeSchema,
  tagSchema,
  workListItemSchema,
  workSchema,
} from "./work.ts";
import { splitSelectedTags, type TagFilters } from "./pseudoTag.ts";
import { dlsiteRegistrationBodySchema, dlsiteStatusSchema } from "./dlsite.ts";
import { workspacePathSchema } from "./media.ts";

// ── 作品検索（GET /api/works）────────────────────────────────

/** GET /works のページサイズ。limit 未指定時にサーバー側で適用するデフォルト（TASK-73）。
 *  client の追加読み込みも同じサイズでページを要求する */
export const WORKS_DEFAULT_PAGE_SIZE = 200;

/** tags= クエリを実タグと year 値へ一度だけ分解する。警告がある入力は拒否する。 */
const tagFiltersQuerySchema = z
  .array(z.string())
  .default([])
  .superRefine((rawTags, ctx) => {
    const { warnings } = splitSelectedTags(rawTags);
    if (warnings.length > 0) {
      ctx.addIssue({ code: "custom", message: warnings.join(" / ") });
    }
  })
  .transform((rawTags): TagFilters => {
    const { tags, yearValue } = splitSelectedTags(rawTags);
    return { tags, yearValue };
  });

/** クエリパラメータ。tags は同名パラメータを繰り返して配列で受ける。組み込み軸（year等）の
 *  フィルタも専用パラメータを持たず、"@year/2024" のような擬似タグとして tags に混ぜて送る
 *  （ADR-0012 §2）。HTTP 境界で tagFiltersQuerySchema が一度だけ解釈し、内側は TagFilters を受け取る。 */
const worksQueryBaseSchema = z.object({
  q: z.string().default(""),
  tags: tagFiltersQuerySchema,
  tagOp: z.enum(["AND", "OR"]).default("AND"),
  view: viewIdSchema.optional(),
  sort: sortIdSchema.default("added-desc"),
  /** randomソートの安定順序を決める。省略時はアダプタが発行してレスポンスで返す。 */
  seed: z.coerce.number().int().min(0).max(0x7fffffff).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  /** 指定IDの作品だけに絞り込む（同名パラメータを繰り返して配列で受ける）。
   *  他のフィルタ・ソート・ページングと組み合わせ可能な通常の絞り込み条件として扱う */
  ids: z.array(z.string()).optional(),
});
export const worksQuerySchema = worksQueryBaseSchema;
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
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type WorksPage = z.infer<typeof worksPageSchema>;

/** GET /api/smart-folders/:id/works のクエリパラメータ。
 *  ソートはフォルダー自身が保持するため含まない。tags はフォルダーのルールに対する
 *  追加の AND 条件として適用する（ADR-0012、TASK-185） */
export const smartFolderWorksQuerySchema = worksQueryBaseSchema.pick({
  tags: true,
  tagOp: true,
  page: true,
  limit: true,
  seed: true,
});
export type SmartFolderWorksQuery = z.infer<typeof smartFolderWorksQuerySchema>;

/** adapter evalSmartFolder が受け取る正規化済みクエリ（page/limit は routes がデフォルト適用後） */
export type SmartFolderEvalQuery = Required<Pick<SmartFolderWorksQuery, "page" | "limit">> &
  Partial<Pick<SmartFolderWorksQuery, "tags" | "tagOp" | "seed">>;

/** GET /api/axes/:axis のクエリパラメータ。値一覧の件数・総時間・代表カバーは、渡された
 *  tags による絞り込み後の集合から集計する（自軸除外カウント、TASK-187）。
 *  自軸由来のフィルタを除外した集合を渡すのは呼び出し側（client）の責務 */
export const axisFacetsQuerySchema = worksQueryBaseSchema.pick({
  tags: true,
  tagOp: true,
});
export type AxisFacetsQuery = z.infer<typeof axisFacetsQuerySchema>;

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

export const workPatchSchema = z
  .object({
    sourceRevision: z.string().min(1).optional(),
    title: z.string().min(1).optional(),
    /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5。prefix 小文字化・trim・重複排除） */
    tags: z
      .array(tagSchema)
      .transform((tags) => dedupeTags(normalizeTags(tags)))
      .optional(),
    bookmarked: z.boolean().optional(),
  })
  .refine(
    (patch) =>
      patch.title !== undefined || patch.tags !== undefined || patch.bookmarked !== undefined,
  );
/** クライアントが送信するリクエストボディ（tags は正規化前の生 string[]） */
export type WorkPatchInput = z.input<typeof workPatchSchema>;
/** サーバーがパース後に扱う型（tags は正規化済み NormalizedTag[]） */
export type WorkPatch = z.output<typeof workPatchSchema>;

// ── 作品の手動登録（POST /api/works, GET /api/works/register-preview）────

export const workRegisterPreviewQuerySchema = z.object({
  path: workspacePathSchema,
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
  path: workspacePathSchema,
  title: z.string().min(1),
  /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5） */
  tags: z
    .array(tagSchema)
    .default([])
    .transform((tags) => dedupeTags(normalizeTags(tags))),
  mergeDescendantWorks: z.boolean().default(false),
  dlsite: dlsiteRegistrationBodySchema.optional(),
});
/** クライアントが送信するリクエストボディ（tags は正規化前の生 string[]） */
export type WorkCreateBodyInput = z.input<typeof workCreateBodySchema>;
/** サーバーがパース後に扱う型（tags は正規化済み NormalizedTag[]） */
export type WorkCreateBody = z.output<typeof workCreateBodySchema>;

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

export const identityConflictReassignBodySchema = z.object({
  path: workspacePathSchema,
});
export type IdentityConflictReassignBody = z.infer<typeof identityConflictReassignBodySchema>;
export const identityConflictReassignResponseSchema = workSchema;
export type IdentityConflictReassignResponse = z.infer<
  typeof identityConflictReassignResponseSchema
>;

/** POST /api/works/:id/resume（高頻度更新のため PATCH と分離） */
export const resumeBodySchema = resumeSchema;
export type ResumeBody = z.infer<typeof resumeBodySchema>;

// ── カバー画像サムネイル（GET /api/media/cover/:id?w=）───────
// キャッシュを有界にするため、許可する幅は離散値のみ。未対応の幅はリクエストされても
// normalizeThumbnailWidth() が最近傍の許可幅へ丸める（同距離は小さい方。
// selectNearestThumbnailWidth は同距離で大きい方。挙動はテストで担保する）。

export const THUMBNAIL_WIDTHS = [128, 256, 512] as const;
export type ThumbnailWidth = (typeof THUMBNAIL_WIDTHS)[number];

export function normalizeThumbnailWidth(width: number): ThumbnailWidth {
  return THUMBNAIL_WIDTHS.reduce((closest, candidate) =>
    Math.abs(candidate - width) < Math.abs(closest - width) ? candidate : closest,
  );
}

export function selectCeilThumbnailWidth(target: number): ThumbnailWidth {
  const fallback = THUMBNAIL_WIDTHS[THUMBNAIL_WIDTHS.length - 1];
  if (fallback === undefined) throw new Error("THUMBNAIL_WIDTHS must not be empty");
  return THUMBNAIL_WIDTHS.find((width) => width >= target) ?? fallback;
}

export function selectNearestThumbnailWidth(target: number): ThumbnailWidth {
  return [...THUMBNAIL_WIDTHS].reduce((nearest, width) =>
    Math.abs(width - target) <= Math.abs(nearest - target) ? width : nearest,
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
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type ExportResponse = z.infer<typeof exportResponseSchema>;

// ── エラー形式 ───────────────────────────────────────────────
// 4xx/5xx は常にこの形で返す。ステータスコードと code の対応:
//   404 not_found / 400 invalid_request / 409 conflict|source_changed / 500 internal

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      "not_found",
      "parse_error",
      "offline",
      "error",
      "invalid_request",
      "conflict",
      "source_changed",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
