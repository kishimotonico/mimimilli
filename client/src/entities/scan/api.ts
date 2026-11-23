// スキャンジョブの開始・取得・取消、直近のスキャンの記録・現在の診断・候補除外の一覧と解除。features/scan・features/files・features/settings・app から参照される共通API。
import {
  ApiRequestError,
  deleteParsed,
  getParsed,
  postParsed,
  postVoid,
  type StatusHandler,
} from "../../shared/api/http";
import {
  scanCandidateExclusionsResponseSchema,
  scanCandidatesMutationSchema,
  scanConflictResponseSchema,
  scanDiagnosticsSchema,
  scanJobSnapshotSchema,
  scanRecordSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanDiagnostics,
  type ScanCandidateExclusion,
  type ScanJobSnapshot,
  type ScanRecord,
  type StartScanRequest,
} from "@mimimilli/shared";

export async function getScanCandidateExclusions(options?: {
  signal?: AbortSignal;
}): Promise<ScanCandidateExclusion[]> {
  const { exclusions } = await getParsed(
    scanCandidateExclusionsResponseSchema,
    "/scan/candidates/exclusions",
    options,
  );
  return exclusions;
}

export async function restoreScanCandidateExclusions(paths: string[]): Promise<void> {
  await postVoid(
    "/scan/candidates/exclusions/restore",
    scanCandidatesMutationSchema.parse({ paths }),
  );
}

/** 直近のスキャンの記録。未スキャン（サーバー再起動後を含む）は finishedAt が null の空の記録。 */
export async function getScanRecord(options?: { signal?: AbortSignal }): Promise<ScanRecord> {
  return getParsed(scanRecordSchema, "/scan/last", options);
}

/** 要対応の現在の診断（ID重複・読み込めない作品情報ファイル）。スキャン完了時点のスナップショットではない。 */
export async function getScanDiagnostics(options?: {
  signal?: AbortSignal;
}): Promise<ScanDiagnostics> {
  return getParsed(scanDiagnosticsSchema, "/scan/diagnostics", options);
}

export class ScanAlreadyActiveError extends ApiRequestError {
  readonly active: ScanJobSnapshot;

  constructor(active: ScanJobSnapshot) {
    super(409, "conflict", "スキャンは既に実行中です");
    this.active = active;
  }
}

const scanConflictHandler: Partial<Record<number, StatusHandler>> = {
  409: (_res, body) => {
    const conflict = scanConflictResponseSchema.safeParse(body);
    if (conflict.success) throw new ScanAlreadyActiveError(conflict.data.active);
  },
};

export async function startScan(options?: StartScanRequest): Promise<ScanJobSnapshot> {
  const body = startScanRequestSchema.parse(options ?? {});
  const { job } = await postParsed(
    startScanResponseSchema,
    "/scan",
    body.full === undefined ? undefined : body,
    {
      onStatus: scanConflictHandler,
    },
  );
  return job;
}

export async function getActiveScan(): Promise<ScanJobSnapshot | null> {
  return getParsed(scanJobSnapshotSchema, "/scan/active", { noContentAsNull: true });
}

export async function getScanJob(id: string): Promise<ScanJobSnapshot> {
  return getParsed(scanJobSnapshotSchema, `/scan/${encodeURIComponent(id)}`);
}

export async function cancelScan(id: string): Promise<ScanJobSnapshot> {
  return deleteParsed(scanJobSnapshotSchema, `/scan/${encodeURIComponent(id)}`);
}
