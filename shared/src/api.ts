// エンドポイント横断の契約: ページングエンベロープ、タグ絞り込みのクエリ、部分更新、エラー形式。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
import {
  dlsiteCoverSkipReasonSchema,
  dlsiteFetchErrorKindSchema,
  metaDlsiteStateSchema,
} from "./dlsite.ts";
import { normalizedTagArraySchema } from "./tagNormalize.ts";
import {
  dedupeTags,
  normalizeTags,
  resumeSchema,
  tagSchema,
  urlEntrySchema,
  workListItemSchema,
} from "./work.ts";
import { MAX_SELECTED_TAGS, splitSelectedTags, type TagFilters } from "./pseudoTag.ts";
import { rjCodeFormatSchema } from "./dlsite.ts";
import { workspacePathSchema } from "./media.ts";

// ── 作品一覧（GET /api/smart-folders/:id/works）───────────────

/** 作品一覧のページサイズ。limit 未指定時にサーバー側で適用するデフォルト。
 *  client の追加読み込みも同じサイズでページを要求する */
export const WORKS_DEFAULT_PAGE_SIZE = 200;

/** tags= クエリを実タグと year 値へ一度だけ分解する。警告がある入力は拒否する。 */
export const tagFiltersQuerySchema = z
  .array(z.string())
  .max(MAX_SELECTED_TAGS, { message: `絞り込みのタグは${MAX_SELECTED_TAGS}個までです` })
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
});
export type WorksPage = z.infer<typeof worksPageSchema>;

/** GET /api/tags */
export const tagListSchema = z.array(z.string());

// ── 行方不明の作品の一括登録解除（GET /api/works/missing-count, POST /api/works/unregister-missing）──

/** status === "missing" の作品数。一括登録解除の確認ダイアログが件数表示に使う */
export const missingWorksCountSchema = z.object({
  count: z.number().int().nonnegative(),
});
export type MissingWorksCount = z.infer<typeof missingWorksCountSchema>;

export const unregisterMissingWorksResultSchema = z.object({
  deletedCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(),
});
export type UnregisterMissingWorksResult = z.infer<typeof unregisterMissingWorksResultSchema>;

// ── 編集 snapshot（GET /api/works/:id/source）────────────────

/** 1回の readMetaSource からだけ組む。閲覧 Work の複製ではない。 */
export const workEditSnapshotSchema = z.object({
  sourceRevision: z.string().min(1),
  id: z.string().min(1),
  physicalPath: z.string().min(1),
  title: z.string().min(1),
  tags: normalizedTagArraySchema,
  urls: z.array(urlEntrySchema),
  coverImage: z.string().nullable(),
  dlsite: metaDlsiteStateSchema,
});
export type WorkEditSnapshot = z.infer<typeof workEditSnapshotSchema>;

export const workProjectionSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("published") }),
  z.object({
    status: z.literal("pending"),
    reason: z.enum(["source_changed", "error", "identity_conflict"]),
  }),
]);
export type WorkProjection = z.infer<typeof workProjectionSchema>;

export const workSourceMutationResultSchema = z.object({
  snapshot: workEditSnapshotSchema,
  projection: workProjectionSchema,
});
export type WorkSourceMutationResult = z.infer<typeof workSourceMutationResultSchema>;

/** カバーを適用する操作の結果。選んだカバーを適用しなかったときだけ理由が入る */
const coverSkippedShape = { coverSkipped: dlsiteCoverSkipReasonSchema.nullable() };

/** POST /api/dlsite/:id/apply のレスポンス */
export const dlsiteApplyResponseSchema = workSourceMutationResultSchema.extend(coverSkippedShape);
export type DlsiteApplyResponse = z.infer<typeof dlsiteApplyResponseSchema>;

/** POST /api/works/projection。register-preview と同じ root 相対 path。 */
export const workProjectionBodySchema = z.object({
  path: workspacePathSchema,
});
export type WorkProjectionBody = z.infer<typeof workProjectionBodySchema>;

// ── 作品正本の部分更新（PATCH /api/works/:id）────────────────

const workSourceTagsSchema = z
  .array(tagSchema)
  .transform((tags) => dedupeTags(normalizeTags(tags)));

export const workSourcePatchSchema = z
  .object({
    sourceRevision: z.string().min(1),
    title: z.string().min(1).optional(),
    /** タグは契約の入口で正規形へ寄せる（ADR-0005 決定5。prefix 小文字化・trim・重複排除） */
    tags: workSourceTagsSchema.optional(),
    urls: z.array(urlEntrySchema).optional(),
  })
  .refine(
    (patch) => patch.title !== undefined || patch.tags !== undefined || patch.urls !== undefined,
  );
/** クライアントが送信するリクエストボディ（tags は正規化前の生 string[]） */
export type WorkSourcePatchInput = z.input<typeof workSourcePatchSchema>;
/** サーバーがパース後に扱う型（tags は正規化済み NormalizedTag[]） */
export type WorkSourcePatch = z.output<typeof workSourcePatchSchema>;

export const workBookmarkPatchSchema = z.object({
  bookmarked: z.boolean(),
});
export type WorkBookmarkPatch = z.infer<typeof workBookmarkPatchSchema>;

export const workBookmarkResultSchema = z.object({
  bookmarked: z.boolean(),
});
export type WorkBookmarkResult = z.infer<typeof workBookmarkResultSchema>;

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
  /** 空文字はRJコードなし */
  rjCode: z.union([z.literal(""), rjCodeFormatSchema]),
  applyCover: z.boolean(),
  applyUrl: z.boolean(),
});
/** クライアントが送信するリクエストボディ（tags は正規化前の生 string[]） */
export type WorkCreateBodyInput = z.input<typeof workCreateBodySchema>;
/** サーバーがパース後に扱う型（tags は正規化済み NormalizedTag[]） */
export type WorkCreateBody = z.output<typeof workCreateBodySchema>;

export const dlsiteFetchByCodeBodySchema = z.object({
  rjCode: rjCodeFormatSchema,
});
export type DlsiteFetchByCodeBody = z.infer<typeof dlsiteFetchByCodeBodySchema>;

/** POST /api/works のレスポンス */
export const workCreateResponseSchema = workSourceMutationResultSchema.extend(coverSkippedShape);
export type WorkCreateResponse = z.infer<typeof workCreateResponseSchema>;

export const identityConflictReassignBodySchema = z.object({
  path: workspacePathSchema,
});
export type IdentityConflictReassignBody = z.infer<typeof identityConflictReassignBodySchema>;
export const identityConflictReassignResponseSchema = workSourceMutationResultSchema;
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
  v: z.string().min(1).optional(),
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
//   404 not_found / 400 invalid_request / 403 forbidden / 415 unsupported_media_type / 409 conflict|source_changed|dlsite_refetch_required|reload_unresolved|root_reconfiguring
//   / 502 parse_error|error / 503 offline / 500 internal
// 本文サイズ超過の 413 は Bun が本文なしで返すため、この形式にならない

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum([
      ...dlsiteFetchErrorKindSchema.options,
      "invalid_request",
      "forbidden",
      "unsupported_media_type",
      "conflict",
      "source_changed",
      "dlsite_refetch_required",
      "reload_unresolved",
      "root_reconfiguring",
      "internal",
    ]),
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
