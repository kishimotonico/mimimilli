import { z } from "zod";

/** DB 読み出し時にデータ不整合で除外した作品の報告（黙って件数を減らさないための UI 用） */
export const dataIntegrityWarningSchema = z.object({
  skippedCount: z.number().int().nonnegative(),
  skippedWorkIds: z.array(z.string()),
});
export type DataIntegrityWarning = z.infer<typeof dataIntegrityWarningSchema>;
