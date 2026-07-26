// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";

export const dlsiteStatusSchema = z.enum(["none", "applied", "not_found", "error", "skipped"]);
export type DlsiteStatus = z.infer<typeof dlsiteStatusSchema>;

export const dlsiteFetchErrorKindSchema = z.enum(["not_found", "parse_error", "offline", "error"]);
export type DlsiteFetchErrorKind = z.infer<typeof dlsiteFetchErrorKindSchema>;

export const dlsiteStateSchema = z.object({
  rjCode: z.string().nullable(),
  status: dlsiteStatusSchema,
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
  errorKind: dlsiteFetchErrorKindSchema.nullable().optional(),
  appliedTags: z.array(z.string()),
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

/** RJコードが未検出のまま放置されている作品か（ユーザーが明示的にスキップした作品は除く）。
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

/** 分母は parse_error + HTTP error（not_found は含めない） */
export function evaluateParseErrorAlert(parseErrorCount: number, httpErrorCount: number): boolean {
  const attempted = parseErrorCount + httpErrorCount;
  return (
    parseErrorCount >= DLSITE_PARSE_ERROR_ALERT_MIN_COUNT &&
    attempted >= DLSITE_PARSE_ERROR_ALERT_MIN_COUNT &&
    parseErrorCount / attempted >= DLSITE_PARSE_ERROR_ALERT_MIN_RATIO
  );
}

/** DLsite未連携（RJコードは判明しているが取得を一度も試みていない）作品か。
 *  通知ベルの「まとめて取得」対象件数（TASK-44）の判定基準。
 *  POST /dlsite/bulk（mode: "existing"）は取得失敗（error）も再試行対象に含めるため、
 *  実際に処理される件数とは意図的に区別している（error は isDlsiteFetchFailed 側で別掲する）。 */
export function isDlsiteUnlinked(state: DlsiteState): boolean {
  return state.rjCode !== null && state.status === "none";
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
  applyTitle: z.boolean(),
  applyTags: z.array(z.string()),
  applyCover: z.boolean(),
});
export type DlsiteApplyBody = z.infer<typeof dlsiteApplyBodySchema>;

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
  skipped: z.number().int().nonnegative(),
});
export type DlsiteBulkResult = z.infer<typeof dlsiteBulkResultSchema>;

export const dlsiteBulkProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    workId: z.string(),
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
