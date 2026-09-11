// scan feature の API。ライブラリのスキャン実行。
// 依存方向: shared/api/http・entities/scan（候補除外の一覧・解除）と自 feature の model のみを参照する。

import {
  ApiRequestError,
  deleteParsed,
  getParsed,
  postParsed,
  postVoid,
  type StatusHandler,
} from "../../shared/api/http";
import { SCAN_QUERY_KEYS } from "../../entities/scan/queryKeys";
import type { StartScanRequest } from "@mimimilli/shared";
import {
  scanConflictResponseSchema,
  scanDiagnosticsResponseSchema,
  scanJobSnapshotSchema,
  scanLastResultResponseSchema,
  scanCandidatesMutationSchema,
  scanCandidatesRegisterRequestSchema,
  scanCandidatesRegisterResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanCandidateRegisterItem,
  type ScanJobSnapshot,
  type ScanLastResultResponse,
  type ScanCandidatesRegisterResponse,
} from "@mimimilli/shared";

export { SCAN_QUERY_KEYS };

export type { ScanResult } from "./model";
export type { StartScanRequest };

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

/** サーバー起動後に一度でも完了したスキャンの結果（TASK-56）。一度も完了していなければnull。 */
export async function getLastScanResult(): Promise<ScanLastResultResponse | null> {
  return getParsed(scanLastResultResponseSchema, "/scan/last", { noContentAsNull: true });
}

export async function registerScanCandidates(
  items: ScanCandidateRegisterItem[],
): Promise<ScanCandidatesRegisterResponse> {
  return postParsed(
    scanCandidatesRegisterResponseSchema,
    "/scan/candidates/register",
    scanCandidatesRegisterRequestSchema.parse({ items }),
  );
}

export async function excludeScanCandidates(paths: string[]): Promise<void> {
  await postVoid("/scan/candidates/exclude", scanCandidatesMutationSchema.parse({ paths }));
}

/** ID重複の診断。スキャン完了時点のスナップショットではなく常に最新を返す。 */
export async function getScanDiagnostics() {
  return getParsed(scanDiagnosticsResponseSchema, "/scan/diagnostics");
}
