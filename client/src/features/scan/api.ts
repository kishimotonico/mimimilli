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
import type { QueryClient } from "@tanstack/react-query";
import {
  SCAN_CANDIDATES_QUERY_KEY,
  SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY,
} from "../../entities/scan/api";
import type { StartScanRequest } from "@mimimilli/shared";
import {
  scanConflictResponseSchema,
  scanDiagnosticsResponseSchema,
  scanJobSnapshotSchema,
  scanLastResultResponseSchema,
  scanCandidatesMutationSchema,
  scanCandidatesRegisterRequestSchema,
  scanCandidatesRegisterResponseSchema,
  scanCandidatesResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanCandidateRegisterItem,
  type ScanJobSnapshot,
  type ScanLastResultResponse,
  type ScanCandidatesRegisterResponse,
  type ScanCandidate,
} from "@mimimilli/shared";

export const SCAN_QUERY_KEYS = {
  last: () => ["scan", "last"] as const,
  candidates: () => SCAN_CANDIDATES_QUERY_KEY,
  candidateExclusions: () => SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY,
  /** files feature の同名キー（features/files/api.ts）と同じ /scan/diagnostics を指す。
   *  各 feature の api.ts は自 feature の model のみに依存する方針のため、意図的に別定義。 */
  diagnostics: () => ["scan", "diagnostics"] as const,
} as const;

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

export async function getScanCandidates(): Promise<ScanCandidate[]> {
  const { candidates } = await getParsed(scanCandidatesResponseSchema, "/scan/candidates");
  return candidates;
}

export async function refreshScanCandidates(queryClient: QueryClient): Promise<ScanCandidate[]> {
  const candidates = await getScanCandidates();
  queryClient.setQueryData(SCAN_QUERY_KEYS.candidates(), candidates);
  return candidates;
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
