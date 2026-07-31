// scan feature の API。ライブラリのスキャン実行。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import {
  ApiRequestError,
  deleteParsed,
  getParsed,
  postParsed,
  type StatusHandler,
} from "../../shared/api/http";
import type { StartScanRequest } from "@mimimilli/shared";
import {
  scanConflictResponseSchema,
  scanJobSnapshotSchema,
  scanLastResultResponseSchema,
  startScanRequestSchema,
  startScanResponseSchema,
  type ScanJobSnapshot,
  type ScanLastResultResponse,
} from "@mimimilli/shared";

export const SCAN_QUERY_KEYS = {
  last: () => ["scan", "last"] as const,
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
