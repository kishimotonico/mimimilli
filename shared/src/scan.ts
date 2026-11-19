// サーバー側スキャンジョブの HTTP / SSE 契約。
import { z } from "zod";
import { dataIntegrityWarningSchema, type DataIntegrityWarning } from "./dataIntegrity.ts";
import {
  dlsiteCachedCoverSchema,
  dlsiteCoverSkipReasonSchema,
  dlsiteRegistrationApplySchema,
  rjCodeFormatSchema,
} from "./dlsite.ts";
import { workspacePathSchema, type WorkspacePath } from "./media.ts";

/** スキャンが見つけた候補フォルダー。DLsiteの状態は持たない（サーバーが候補一覧を返すときに導く） */
export type ScanCandidateFolder = {
  path: z.infer<typeof workspacePathSchema>;
  inferredTitle: string;
  audioFileCount: number;
  audioBreakdown: { extension: string; count: number }[];
  /** フォルダー名から検出したRJコード。未検出は null */
  detectedRjCode: string | null;
};

export const scanCandidateDlsiteSchema = z.discriminatedUnion("state", [
  /** 未取得（キャッシュに無い・TTL切れ・RJコードなし） */
  z.object({ state: z.literal("none") }),
  z.object({
    state: z.literal("fetched"),
    title: z.string(),
    /** null はカバーの先取りに失敗してキャッシュに無い */
    cover: dlsiteCachedCoverSchema.nullable(),
  }),
  z.object({ state: z.literal("not_found") }),
  z.object({ state: z.literal("failed") }),
]);
export type ScanCandidateDlsite = z.infer<typeof scanCandidateDlsiteSchema>;

/** 同じRJコードを持つ、行方不明（catalogでmissing）の作品 */
export const scanCandidateMissingWorkSchema = z.object({
  workId: z.string(),
  title: z.string(),
});
export type ScanCandidateMissingWork = z.infer<typeof scanCandidateMissingWorkSchema>;

export const scanCandidateSchema = z.object({
  path: workspacePathSchema,
  inferredTitle: z.string().min(1),
  audioFileCount: z.number().int().positive(),
  audioBreakdown: z.array(
    z.object({ extension: z.string().min(1), count: z.number().int().positive() }),
  ),
  /** 直したRJコード、なければフォルダー名から検出したRJコード。どちらも無ければ null。 */
  rjCode: z.string().nullable(),
  /** RJコードを直した上書きがある（コードなしに直した場合も含む） */
  rjCodeEdited: z.boolean(),
  /** rjCode が null のときは常に none */
  dlsite: scanCandidateDlsiteSchema,
  missingWorks: z.array(scanCandidateMissingWorkSchema),
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
/** 空文字はRJコードなしの明示。値ありは検証・正規化して候補一覧に保持する。 */
export const scanCandidateRjCodeRequestSchema = z.object({
  path: workspacePathSchema,
  rjCode: z.union([z.literal(""), rjCodeFormatSchema]),
});
export const scanCandidateRjCodeResponseSchema = z.object({ candidate: scanCandidateSchema });
/** 1リクエストで追加できる候補の上限。クライアントはこれごとに分割して送る */
export const SCAN_CANDIDATE_REGISTER_MAX_PATHS = 20;
/** RJコードとDLsite情報はサーバーが候補一覧とキャッシュから読む */
export const scanCandidatesRegisterRequestSchema = z.object({
  paths: z
    .array(workspacePathSchema)
    .min(1)
    .max(SCAN_CANDIDATE_REGISTER_MAX_PATHS)
    .refine((paths) => new Set(paths).size === paths.length, "候補パスが重複しています"),
  apply: dlsiteRegistrationApplySchema,
});
export const scanCandidateExclusionsResponseSchema = z.object({
  paths: z.array(workspacePathSchema),
});
export const scanCandidateRegistrationSchema = z.object({
  path: workspacePathSchema,
  workId: z.string(),
  coverSkipped: dlsiteCoverSkipReasonSchema.nullable(),
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

/** 既存作品に起きた変化の1つ。movedのfrom/toは作品フォルダー（単体音声作品は音声ファイル）のroot相対path。 */
export const workChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("moved"), from: workspacePathSchema, to: workspacePathSchema }),
  z.object({ kind: z.literal("meta") }),
  /** 音声・カバー等の増減や差し替え。audioDeltaは音声ファイル数の増減（差し替えのみなら0）。 */
  z.object({ kind: z.literal("files"), audioDelta: z.number().int() }),
]);
export type WorkChange = z.infer<typeof workChangeSchema>;
export const workChangeKindSchema = z.enum(["moved", "meta", "files"]);
export type WorkChangeKind = z.infer<typeof workChangeKindSchema>;

/** GET /works の scanRecord 絞り込みが指す、スキャンの記録の作品集合 */
export const scanRecordKindSchema = z.enum(["new", "updated"]);
export type ScanRecordKind = z.infer<typeof scanRecordKindSchema>;

export const updatedWorkSchema = z.object({
  workId: z.string(),
  /** 1つ以上。種類ごとに高々1つ。 */
  changes: z.array(workChangeSchema).min(1),
});
export type UpdatedWork = z.infer<typeof updatedWorkSchema>;

/** 今回のスキャンで新たに行方不明になった作品。以前から行方不明の作品は含まない */
export const missingWorkSchema = z.object({
  workId: z.string(),
  title: z.string(),
  /** 行方不明になる前の作品フォルダー（単体音声作品は音声ファイル）のroot相対path */
  previousPath: workspacePathSchema,
});
export type MissingWork = z.infer<typeof missingWorkSchema>;

/** adapter が返すスキャン1回分の結果。HTTPには出さず、サーバーの記録（ScanRecord）の元になる */
export interface ScanResult {
  registered: number;
  /** 今回のスキャンでカタログへ新規挿入された Work ID（mimimilli.json の自動投影） */
  insertedWorkIds: string[];
  /** スキャン開始時点でカタログに作品が1件も無かった。true のとき記録の新規作品は空にする */
  startedWithEmptyCatalog: boolean;
  /** 今回のスキャンで新たに行方不明になった作品 */
  missingWorks: MissingWork[];
  /** 今回のスキャンで変化が見つかった既存作品。エラーからの復帰や全件読み直しで読み直しただけの作品は含まない */
  updatedWorks: UpdatedWork[];
  errors: number;
  missing: number;
  /** 増分スキャンで fingerprint が一致し、プローブ・upsertWork を省略した作品数 */
  skipped: number;
  /** カバー画像はあるが寸法を計測できなかった作品数（errors とは別枠。次回スキャンで再試行） */
  coverErrors: number;
  /** 走査中に読み取れなかったサブツリーのディレクトリのroot相対path。ルート失敗時はスキャン自体がエラーになる */
  unreadablePaths: WorkspacePath[];
  /** finalize 時の listSummaries() でタグ等の不整合により除外した作品。その実行の警告 */
  dataIntegrityWarning?: DataIntegrityWarning;
}

/** 同じ Work ID を持つ mimimilli.json が複数見つかった診断。paths はroot相対・separator正規化済みのportable pathで、相互参照用に全件を含む。 */
export const identityConflictSchema = z.object({
  kind: z.literal("identity_conflict"),
  workId: z.string(),
  paths: z.array(workspacePathSchema).min(2),
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

/** GET /scan/last の返却値。直近のスキャンで見つかったものの現在の記録で、サーバーのメモリにだけ持つ。
 *  寿命は次のスキャンかサーバー再起動まで。未スキャンのときは finishedAt が null の空の記録。
 *  新規作品は件数が多くなりうるため含めず、GET /works?scanRecord=new で取る。 */
export const scanRecordSchema = z.object({
  finishedAt: z.string().nullable(),
  updatedWorks: z.array(updatedWorkSchema),
  missingWorks: z.array(missingWorkSchema),
  unreadablePaths: z.array(workspacePathSchema),
  dataIntegrityWarning: dataIntegrityWarningSchema.optional(),
});
export type ScanRecord = z.infer<typeof scanRecordSchema>;

/** 接続時は現在snapshotを`state`で1件送り、以後はliveのイベントを送る。 */
export const scanJobEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("state"), snapshot: scanJobSnapshotSchema }),
  z.object({ type: z.literal("progress"), progress: scanProgressSchema }),
  z.object({ type: z.literal("completed"), finishedAt: z.string() }),
  z.object({ type: z.literal("failed"), error: z.string() }),
  z.object({ type: z.literal("cancelled") }),
]);
export type ScanJobEvent = z.infer<typeof scanJobEventSchema>;
