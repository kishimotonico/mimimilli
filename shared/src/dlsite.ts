// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
import { normalizedTagArraySchema, normalizedTagInputArraySchema } from "./tagNormalize.ts";

export const dlsiteStatusSchema = z.enum(["none", "applied", "not_found", "error", "skipped"]);
export type DlsiteStatus = z.infer<typeof dlsiteStatusSchema>;

export const dlsiteFetchErrorKindSchema = z.enum(["not_found", "parse_error", "offline", "error"]);
export type DlsiteFetchErrorKind = z.infer<typeof dlsiteFetchErrorKindSchema>;

export const dlsiteStateSchema = z.object({
  rjCode: z.string().nullable(),
  status: dlsiteStatusSchema,
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
  errorKind: dlsiteFetchErrorKindSchema.nullable().default(null),
  appliedTags: normalizedTagArraySchema.default([]),
});
export type DlsiteState = z.infer<typeof dlsiteStateSchema>;

export function emptyDlsiteState(): DlsiteState {
  return {
    rjCode: null,
    status: "none",
    lastAttemptAt: null,
    error: null,
    errorKind: null,
    appliedTags: [],
  };
}

/** RJコードが非空文字列として設定されているか。`null` と明示的な `""` は含まない。 */
export function hasRjCode(state: Pick<DlsiteState, "rjCode">): boolean {
  return state.rjCode !== null && state.rjCode !== "";
}

/** RJコードが未検出のまま放置されている作品か（ユーザーが明示的にスキップした作品は除く）。
 *  `rjCode === ""` はユーザーが明示的にRJコードなしとした状態であり、未検出には含めない。
 *  スキャン完了通知・一覧の両方で判定基準を一致させるための正典 */
export function isRjCodeMissing(state: DlsiteState): boolean {
  return state.rjCode === null && state.status !== "skipped";
}

/** DLsiteのHTMLパースに失敗したまま残っている作品か */
export function isDlsiteParseFailed(state: DlsiteState): boolean {
  return state.status === "error" && state.errorKind === "parse_error";
}

/** DLsite取得が失敗したまま残っている（HTTP 404・通信エラー等。parse_error は除く）作品か */
export function isDlsiteFetchFailed(state: DlsiteState): boolean {
  return (
    state.status === "not_found" || (state.status === "error" && state.errorKind !== "parse_error")
  );
}

/** パース失敗が構造変更レベルで増えたかのしきい値（件数・割合の下限） */
export const DLSITE_PARSE_ERROR_ALERT_MIN_COUNT = 3;
export const DLSITE_PARSE_ERROR_ALERT_MIN_RATIO = 0.2;

/** 分母はパース成功 + パース失敗（HTTPエラー・not_found はパース未到達のため含めない） */
export function evaluateParseErrorAlert(
  parseErrorCount: number,
  parseSuccessCount: number,
): boolean {
  const attempted = parseErrorCount + parseSuccessCount;
  return (
    parseErrorCount >= DLSITE_PARSE_ERROR_ALERT_MIN_COUNT &&
    attempted > 0 &&
    parseErrorCount / attempted >= DLSITE_PARSE_ERROR_ALERT_MIN_RATIO
  );
}

/** DLsite未連携（RJコードは判明しているが取得を一度も試みていない）作品か。
 *  通知ベルの「まとめて取得」対象件数（TASK-44）の判定基準。
 *  POST /dlsite/bulk（mode: "existing"）は取得失敗（error）も再試行対象に含めるため、
 *  実際に処理される件数とは意図的に区別している（error は isDlsiteFetchFailed 側で別掲する）。 */
export function isDlsiteUnlinked(state: DlsiteState): boolean {
  return hasRjCode(state) && state.status === "none";
}

export const dlsiteWorkInfoSchema = z.object({
  rjCode: z.string(),
  title: z.string(),
  circle: z.string().nullable(),
  cvs: z.array(z.string()),
  genreTags: z.array(z.string()),
  coverUrl: z.string().nullable(),
  url: z.string(),
});
export type DlsiteWorkInfo = z.infer<typeof dlsiteWorkInfoSchema>;

/** 作品ごとの取得結果確認に使う。sourceRevision は適用時のCASトークン。 */
export const dlsitePreviewSchema = z.object({
  info: dlsiteWorkInfoSchema,
  sourceRevision: z.string().min(1),
});
export type DlsitePreview = z.infer<typeof dlsitePreviewSchema>;

export const dlsiteFetchResultSchema = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), info: dlsiteWorkInfoSchema }),
  z.object({
    ok: z.literal(false),
    kind: dlsiteFetchErrorKindSchema,
    message: z.string(),
  }),
]);
export type DlsiteFetchResult = z.infer<typeof dlsiteFetchResultSchema>;

export const dlsiteApplyBodySchema = z.object({
  info: dlsiteWorkInfoSchema,
  sourceRevision: z.string().min(1),
  applyTitle: z.boolean(),
  applyTags: normalizedTagInputArraySchema,
  applyCover: z.boolean(),
  applyUrl: z.boolean(),
});
/** クライアントが送信するリクエストボディ（applyTags は正規化前の生 string[]） */
export type DlsiteApplyBodyInput = z.input<typeof dlsiteApplyBodySchema>;
/** サーバーがパース後に扱う型（applyTags は正規化済み NormalizedTag[]） */
export type DlsiteApplyBody = z.output<typeof dlsiteApplyBodySchema>;

/** 新規登録時はmimimilli.jsonがまだ存在しないためCASトークンを持たない。 */
export const dlsiteRegistrationBodySchema = dlsiteApplyBodySchema.omit({ sourceRevision: true });
export type DlsiteRegistrationBody = z.output<typeof dlsiteRegistrationBodySchema>;

export const dlsiteBulkApplyMissingResultSchema = z.object({
  applied: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
export type DlsiteBulkApplyMissingResult = z.infer<typeof dlsiteBulkApplyMissingResultSchema>;

export const dlsiteStatePatchSchema = z
  .object({
    rjCode: z
      .string()
      .trim()
      .regex(/^(RJ|VJ)\d{6,8}$/i, "RJ/VJコードはRJまたはVJに続く6〜8桁で入力してください")
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
    skipped: z.boolean().optional(),
  })
  .refine((patch) => patch.rjCode !== undefined || patch.skipped !== undefined);
export type DlsiteStatePatch = z.infer<typeof dlsiteStatePatchSchema>;

/** updateDlsiteState の状態遷移（real/fixture 共通）。
 *  RJコードが変わったときだけ旧コード由来の取得結果を捨てて未取得に戻す。
 *  skipped 指定時は従来どおり status/error/errorKind を上書きする（rjCode 変更より後に適用）。 */
export function applyDlsiteStatePatch(current: DlsiteState, patch: DlsiteStatePatch): DlsiteState {
  let next: DlsiteState = { ...current };

  if (patch.rjCode !== undefined) {
    next.rjCode = patch.rjCode;
    if (patch.rjCode !== current.rjCode) {
      next = {
        ...next,
        status: "none",
        lastAttemptAt: null,
        error: null,
        errorKind: null,
        appliedTags: [],
      };
    }
  }

  if (patch.skipped !== undefined) {
    next = {
      ...next,
      status: patch.skipped ? "skipped" : "none",
      error: null,
      errorKind: null,
    };
  }

  return next;
}

export const dlsiteBulkModeSchema = z.enum(["new", "existing"]);
export type DlsiteBulkMode = z.infer<typeof dlsiteBulkModeSchema>;

/** POST /api/dlsite/bulk のジョブ開始レスポンス */
export const dlsiteBulkStartResponseSchema = z.object({
  started: z.literal(true),
});
export type DlsiteBulkStartResponse = z.infer<typeof dlsiteBulkStartResponseSchema>;

export const dlsiteBulkResultSchema = z.object({
  fetched: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  parseErrors: z.number().int().nonnegative(),
  /** 一括処理の対象外だった作品数（RJ未設定・適用済み・skipped 等） */
  skipped: z.number().int().nonnegative(),
  /** listSummaries でタグ等の不整合により除外した作品 */
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type DlsiteBulkResult = z.infer<typeof dlsiteBulkResultSchema>;

/** 一括取得で現在処理中の作品。全件終わった直後は null */
export const dlsiteBulkProgressWorkSchema = z.object({
  id: z.string(),
  rjCode: z.string(),
  title: z.string(),
});
export type DlsiteBulkProgressWork = z.infer<typeof dlsiteBulkProgressWorkSchema>;

export const dlsiteBulkProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    work: dlsiteBulkProgressWorkSchema.nullable(),
  }),
  z.object({ type: z.literal("cancelling") }),
  z.object({ type: z.literal("complete"), result: dlsiteBulkResultSchema }),
  z.object({ type: z.literal("cancelled"), result: dlsiteBulkResultSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type DlsiteBulkProgressEvent = z.infer<typeof dlsiteBulkProgressEventSchema>;

/** DELETE /api/dlsite/bulk のレスポンス */
export const dlsiteBulkCancelResponseSchema = z.object({
  cancelling: z.literal(true),
});
export type DlsiteBulkCancelResponse = z.infer<typeof dlsiteBulkCancelResponseSchema>;

const dlsiteBulkProgressSnapshotSchema = z.object({
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  work: dlsiteBulkProgressWorkSchema.nullable(),
});
export type DlsiteBulkProgressSnapshot = z.infer<typeof dlsiteBulkProgressSnapshotSchema>;

/** GET /api/dlsite/bulk のジョブ状態（実行中・直近の終了結果）。未実行・終了後クリア時は 204 */
export const dlsiteBulkSnapshotSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("running"),
    progress: dlsiteBulkProgressSnapshotSchema.nullable(),
  }),
  z.object({
    status: z.literal("cancelling"),
    progress: dlsiteBulkProgressSnapshotSchema.nullable(),
  }),
  z.object({ status: z.literal("complete"), result: dlsiteBulkResultSchema }),
  z.object({ status: z.literal("cancelled"), result: dlsiteBulkResultSchema }),
  z.object({ status: z.literal("error"), message: z.string() }),
]);
export type DlsiteBulkSnapshot = z.infer<typeof dlsiteBulkSnapshotSchema>;
