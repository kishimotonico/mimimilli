// サーバー側スキャンジョブの HTTP / SSE 契約。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
import { rjCodeFormatSchema } from "./dlsite.ts";
import { workspacePathSchema } from "./media.ts";

export const scanCandidateSchema = z.object({
  path: workspacePathSchema,
  inferredTitle: z.string().min(1),
  audioFileCount: z.number().int().positive(),
  audioBreakdown: z.array(
    z.object({ extension: z.string().min(1), count: z.number().int().positive() }),
  ),
  /** フォルダー名から検出したRJコード。未検出は null。 */
  rjCode: z.string().nullable(),
});
export type ScanCandidate = z.infer<typeof scanCandidateSchema>;

export const invalidMetaFileSchema = z.object({
  path: workspacePathSchema,
  message: z.string().min(1),
});
export type InvalidMetaFile = z.infer<typeof invalidMetaFileSchema>;

export const scanCandidatesResponseSchema = z.object({ candidates: z.array(scanCandidateSchema) });
export const scanCandidatesMutationSchema = z.object({
  paths: z
    .array(workspacePathSchema)
    .min(1)
    .refine((paths) => new Set(paths).size === paths.length, "候補パスが重複しています"),
});
export const scanCandidateRegisterItemSchema = z.object({
  path: workspacePathSchema,
  /** 省略時はフォルダー名から自動検出。空文字はRJコードなしの明示。値ありは検証・正規化して mimimilli.json へ書き込む。 */
  rjCode: z.union([z.literal(""), rjCodeFormatSchema]).optional(),
});
export const scanCandidatesRegisterRequestSchema = z.object({
  items: z
    .array(scanCandidateRegisterItemSchema)
    .min(1)
    .refine((items) => new Set(items.map((item) => item.path)).size === items.length, {
      message: "候補パスが重複しています",
    }),
});
export type ScanCandidateRegisterItem = z.infer<typeof scanCandidateRegisterItemSchema>;
export const scanCandidateExclusionsResponseSchema = z.object({
  paths: z.array(workspacePathSchema),
});
export const scanCandidateRegistrationSchema = z.object({
  path: workspacePathSchema,
  workId: z.string(),
});
export const scanCandidateRegistrationFailureSchema = z.object({
  path: workspacePathSchema,
  message: z.string().min(1),
});
export const scanCandidatesRegisterResponseSchema = z.object({
  registered: z.array(scanCandidateRegistrationSchema),
  failures: z.array(scanCandidateRegistrationFailureSchema),
});
export type ScanCandidatesRegisterResponse = z.infer<typeof scanCandidatesRegisterResponseSchema>;

export const scanResultSchema = z.object({
  registered: z.number().int().nonnegative(),
  /** 今回のスキャンでカタログへ新規挿入された Work ID（mimimilli.json の自動投影） */
  insertedWorkIds: z.array(z.string()),
  /** 今回のスキャンでメタファイル更新等により再投影された Work ID */
  updatedWorkIds: z.array(z.string()),
  errors: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  /** 増分スキャンで fingerprint が一致し、プローブ・upsertWork を省略した作品数 */
  skipped: z.number().int().nonnegative(),
  /** カバー画像はあるが寸法を計測できなかった作品数（errors とは別枠。次回スキャンで再試行） */
  coverErrors: z.number().int().nonnegative(),
  /** 走査中に読み取れなかったサブツリーのディレクトリパス。ルート失敗時はスキャン自体がエラーになる */
  unreadablePaths: z.array(z.string()).optional(),
  /** finalize 時の listSummaries() でタグ等の不整合により除外した作品。その実行の警告で、サーバー再起動後は次のスキャンまで得られない */
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

/** 同じ Work ID を持つ mimimilli.json が複数見つかった診断。paths はroot相対・separator正規化済みのportable pathで、相互参照用に全件を含む。 */
export const identityConflictSchema = z.object({
  kind: z.literal("identity_conflict"),
  workId: z.string(),
  paths: z.array(z.string()).min(2),
});
export type IdentityConflict = z.infer<typeof identityConflictSchema>;

/** GET /scan/diagnostics の返却値。要対応の現在状態で、スキャンの実行結果ではない。 */
export const scanDiagnosticsSchema = z.object({
  identityConflicts: z.array(identityConflictSchema),
  /** 読み取りまたは検証に失敗した作品情報ファイル。pathはroot相対のportable path。 */
  invalidMetaFiles: z.array(invalidMetaFileSchema),
});
export type ScanDiagnostics = z.infer<typeof scanDiagnosticsSchema>;

/** スキャンの大まかな進行段階（各アダプタの scanner 相当の処理に対応） */
export const scanPhaseSchema = z.enum(["walking", "registering", "generating", "finalizing"]);
export type ScanPhase = z.infer<typeof scanPhaseSchema>;

/** adapter内部の進捗コールバック契約。完了・失敗は ScanJobManager が別経路で扱う。 */
export const scanProgressEventSchema = z.object({
  type: z.literal("progress"),
  phase: scanPhaseSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});
export type ScanProgressEvent = z.infer<typeof scanProgressEventSchema>;

export const scanJobStatusSchema = z.enum([
  "queued",
  "running",
  "cancelling",
  "completed",
  "failed",
  "cancelled",
]);
export type ScanJobStatus = z.infer<typeof scanJobStatusSchema>;

const scanProgressSchema = z.object({
  phase: scanPhaseSchema,
  processed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

/** GET /scan/:id と POST /scan の返却値。日時は ISO 8601 文字列で統一する。 */
export const scanJobSnapshotSchema = z.object({
  id: z.string().min(1),
  status: scanJobStatusSchema,
  createdAt: z.string(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  progress: scanProgressSchema.nullable(),
  result: scanResultSchema.nullable(),
  error: z.string().nullable(),
});
export type ScanJobSnapshot = z.infer<typeof scanJobSnapshotSchema>;

/** POST /scan のリクエストボディ。省略時は増分スキャン（fingerprint 一致作品はスキップ）。 */
export const startScanRequestSchema = z.object({
  full: z.boolean().optional(),
});
export type StartScanRequest = z.infer<typeof startScanRequestSchema>;

export const startScanResponseSchema = z.object({ job: scanJobSnapshotSchema });
export type StartScanResponse = z.infer<typeof startScanResponseSchema>;

export const scanConflictResponseSchema = z.object({
  error: z.object({ code: z.literal("conflict"), message: z.string() }),
  active: scanJobSnapshotSchema,
});
export type ScanConflictResponse = z.infer<typeof scanConflictResponseSchema>;

/** GET /scan/last の返却値。サーバー起動後に一度でも完了したスキャンの結果を保持する（ディスク永続化はしない）。 */
export const scanLastResultResponseSchema = z.object({
  result: scanResultSchema,
  finishedAt: z.string(),
});
export type ScanLastResultResponse = z.infer<typeof scanLastResultResponseSchema>;

/** 接続時は現在snapshotを`state`で1件送り、以後はliveのイベントを送る。 */
export const scanJobEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), snapshot: scanJobSnapshotSchema }),
  z.object({ type: z.literal("progress"), progress: scanProgressSchema }),
  z.object({ type: z.literal("completed"), result: scanResultSchema }),
  z.object({ type: z.literal("failed"), error: z.string() }),
  z.object({ type: z.literal("cancelled") }),
]);
export type ScanJobEvent = z.infer<typeof scanJobEventSchema>;
