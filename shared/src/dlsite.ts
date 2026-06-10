// DLsite 連携（POST /api/dlsite/:id/fetch | apply）の契約。
import { z } from "zod";

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

export const dlsiteApplyBodySchema = z.object({
  info: dlsiteWorkInfoSchema,
  applyTitle: z.boolean(),
  applyTags: z.boolean(),
  applyCover: z.boolean(),
});
export type DlsiteApplyBody = z.infer<typeof dlsiteApplyBodySchema>;
