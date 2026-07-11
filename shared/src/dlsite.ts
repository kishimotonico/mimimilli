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
      .regex(/^RJ\d{6,8}$/i, "RJコードはRJに続く6〜8桁で入力してください")
      .transform((value) => value.toUpperCase())
      .nullable()
      .optional(),
    skipped: z.boolean().optional(),
  })
  .refine((patch) => patch.rjCode !== undefined || patch.skipped !== undefined);
export type DlsiteStatePatch = z.infer<typeof dlsiteStatePatchSchema>;
