// サーバー側スキャンジョブ（TASK-76）の HTTP / SSE 契約。
import { z } from "zod";
import { dataIntegrityWarningSchema } from "./dataIntegrity.ts";
import { workspacePathSchema } from "./media.ts";

export const scanCandidateSchema = z.object({
  path: workspacePathSchema,
  inferredTitle: z.string().min(1),
  audioFileCount: z.number().int().positive(),
  audioBreakdown: z.array(
    z.object({ extension: z.string().min(1), count: z.number().int().positive() }),
  ),
});
export type ScanCandidate = z.infer<typeof scanCandidateSchema>;

export const invalidSidecarSchema = z.object({
  path: workspacePathSchema,
  message: z.string().min(1),
});
export type InvalidSidecar = z.infer<typeof invalidSidecarSchema>;

export const scanCandidatesResponseSchema = z.object({ candidates: z.array(scanCandidateSchema) });
export const scanCandidatesMutationSchema = z.object({
  paths: z
    .array(workspacePathSchema)
    .min(1)
    .refine((paths) => new Set(paths).size === paths.length, "候補パスが重複しています"),
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
  newlyGenerated: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  missing: z.number().int().nonnegative(),
  newWorkIds: z.array(z.string()),
  /** スキャン完了時点でRJコード未検出（かつ未スキップ）のまま残っている作品数。
   *  新規作品に限らずライブラリ全体を対象に数える（isRjCodeMissing が判定基準） */
  rjCodeMissingCount: z.number().int().nonnegative(),
  /** 増分スキャンで fingerprint が一致し、プローブ・upsertWork を省略した作品数（TASK-75） */
  skipped: z.number().int().nonnegative(),
  /** カバー画像はあるが寸法を計測できなかった作品数（errors とは別枠。次回スキャンで再試行） */
  coverErrors: z.number().int().nonnegative(),
  /** 走査中に読み取れなかったサブツリーのディレクトリパス。ルート失敗時はスキャン自体がエラーになる */
  unreadablePaths: z.array(z.string()).optional(),
  /** finalize 時の listSummaries でタグ等の不整合により除外した作品 */
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
  /** 同じ Work ID を持つ sidecar が複数見つかった診断。paths はroot相対・separator正規化済みのportable pathで、相互参照用に全件を含む。 */
  identityConflicts: z.array(
    z.object({
      kind: z.literal("identity_conflict"),
      workId: z.string(),
      paths: z.array(z.string()).min(2),
    }),
  ),
  /** 読み取りまたは検証に失敗したsidecar。pathはroot相対のportable path。 */
  invalidSidecars: z.array(invalidSidecarSchema),
  /** sidecar を持たない音声フォルダー。scan はこの候補へ書き込まない。 */
  candidates: z.array(scanCandidateSchema),
});
export type ScanResult = z.infer<typeof scanResultSchema>;

export type ScanDiagnostic = ScanResult["identityConflicts"][number];
export const scanDiagnosticsResponseSchema = z.object({
  diagnostics: z.array(scanResultSchema.shape.identityConflicts.element),
});

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

/** `seq` はジョブ内で単調増加する。reset は履歴が切り詰められた再接続時の完全状態である。 */
export const scanJobEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("reset"),
    seq: z.number().int().nonnegative(),
    snapshot: scanJobSnapshotSchema,
  }),
  z.object({
    type: z.literal("state"),
    seq: z.number().int().nonnegative(),
    snapshot: scanJobSnapshotSchema,
  }),
  z.object({
    type: z.literal("progress"),
    seq: z.number().int().nonnegative(),
    progress: scanProgressSchema,
  }),
  z.object({
    type: z.literal("completed"),
    seq: z.number().int().nonnegative(),
    result: scanResultSchema,
  }),
  z.object({ type: z.literal("failed"), seq: z.number().int().nonnegative(), error: z.string() }),
  z.object({ type: z.literal("cancelled"), seq: z.number().int().nonnegative() }),
]);
export type ScanJobEvent = z.infer<typeof scanJobEventSchema>;
