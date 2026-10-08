// スキャンジョブの開始・取得・取消、直近のスキャン結果・現在の診断・候補除外の一覧と解除。features/scan・features/files・features/settings・app から参照される共通API。
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
  scanLastResultResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanDiagnostics,
  type ScanJobSnapshot,
  type ScanLastResultResponse,
  type StartScanRequest,
} from "@mimimilli/shared";
import { SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY } from "./queryKeys";

export { SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY };

export async function getScanCandidateExclusions(): Promise<string[]> {
  const { paths } = await getParsed(
    scanCandidateExclusionsResponseSchema,
    "/scan/candidates/exclusions",
  );
  return paths;
}

export async function restoreScanCandidateExclusions(paths: string[]): Promise<void> {
  await postVoid(
    "/scan/candidates/exclusions/restore",
    scanCandidatesMutationSchema.parse({ paths }),
  );
}

/** サーバー起動後に一度でも完了したスキャンの実行サマリー。一度も完了していなければnull。 */
export async function getLastScanResult(): Promise<ScanLastResultResponse | null> {
  return getParsed(scanLastResultResponseSchema, "/scan/last", { noContentAsNull: true });
}

/** 要対応の現在の診断（ID重複・読み込めない作品情報ファイル）。スキャン完了時点のスナップショットではない。 */
export async function getScanDiagnostics(): Promise<ScanDiagnostics> {
  return getParsed(scanDiagnosticsSchema, "/scan/diagnostics");
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
