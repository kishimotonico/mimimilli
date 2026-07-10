// スキャン（POST /api/scan、GET /api/scan/events）の契約。
//
// POST /api/scan は完了まで待って ScanResult を返す（同期）。
// GET /api/scan/events はその実行と並行して進捗を SSE で配信する副チャンネル（TASK-20）。
// スキャンが実行中でないときに接続した場合は、直近の終了イベント（あれば）を1件だけ
// 流してすぐにストリームを閉じる（サーバー側の挙動は server/src/routes/scanProgress.ts）。
import { z } from "zod";

export const scanResultSchema = z.object({
  registered: z.number().int().nonnegative(),
  newlyGenerated: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  newWorkIds: z.array(z.string()),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

/** スキャンの大まかな進行段階（各アダプタの scanner 相当の処理に対応） */
export const scanPhaseSchema = z.enum(["walking", "registering", "generating", "finalizing"]);
export type ScanPhase = z.infer<typeof scanPhaseSchema>;

/**
 * GET /api/scan/events が配信する SSE イベント（SSE の `event:` フィールドに type を使う）。
 * - progress: phase 内での processed/total（total=0 は「未確定・不定」を表す）
 * - complete: ScanResult を伴う終了イベント
 * - error: スキャン失敗時の終了イベント
 */
export const scanProgressEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("progress"),
    phase: scanPhaseSchema,
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal("complete"),
    result: scanResultSchema,
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);
export type ScanProgressEvent = z.infer<typeof scanProgressEventSchema>;
