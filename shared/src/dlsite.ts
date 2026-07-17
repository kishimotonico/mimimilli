// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";

export const dlsiteStatusSchema = z.enum(["none", "applied", "not_found", "error", "skipped"]);
export type DlsiteStatus = z.infer<typeof dlsiteStatusSchema>;

export const dlsiteStateSchema = z.object({
  rjCode: z.string().nullable(),
  status: dlsiteStatusSchema,
  lastAttemptAt: z.iso.datetime({ offset: true }).nullable(),
  error: z.string().nullable(),
  appliedTags: z.array(z.string()),
});
export type DlsiteState = z.infer<typeof dlsiteStateSchema>;

export function emptyDlsiteState(): DlsiteState {
  return { rjCode: null, status: "none", lastAttemptAt: null, error: null, appliedTags: [] };
}

/** RJコードが未検出のまま放置されている作品か（ユーザーが明示的にスキップした作品は除く）。
 *  スキャン完了通知・一覧の両方で判定基準を一致させるための正典 */
export function isRjCodeMissing(state: DlsiteState): boolean {
  return state.rjCode === null && state.status !== "skipped";
}

/** DLsite取得が失敗したまま残っている（RJコードはあるが取得できなかった）作品か。
 *  作品詳細の警告表示・通知ベル（TASK-44）の判定基準の正典 */
export function isDlsiteFetchFailed(state: DlsiteState): boolean {
  return state.status === "error" || state.status === "not_found";
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

export const dlsiteFetchErrorKindSchema = z.enum(["not_found", "parse_error", "error"]);
export type DlsiteFetchErrorKind = z.infer<typeof dlsiteFetchErrorKindSchema>;

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

export const dlsiteBulkResultSchema = z.object({
  fetched: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
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
  z.object({ type: z.literal("complete"), result: dlsiteBulkResultSchema }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type DlsiteBulkProgressEvent = z.infer<typeof dlsiteBulkProgressEventSchema>;
