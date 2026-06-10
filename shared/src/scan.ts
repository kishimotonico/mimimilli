// スキャン（POST /api/scan）の契約。
// 現段階では同期実行で ScanResult を返す。SSE 進捗通知（GET /api/scan/events）は
// 体験改善フェーズで追加し、その際 POST /api/scan は 202 を返す形へ移行する。
import { z } from "zod";

export const scanResultSchema = z.object({
  registered: z.number().int().nonnegative(),
  newlyGenerated: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  newWorkIds: z.array(z.string()),
});
export type ScanResult = z.infer<typeof scanResultSchema>;
