// scan feature の API。ライブラリのスキャン実行。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import { API_BASE, ApiRequestError, ApiResponseSchemaError } from "../../shared/api/http";
import {
  scanConflictResponseSchema,
  scanJobSnapshotSchema,
  scanLastResultResponseSchema,
  startScanResponseSchema,
  type ScanJobSnapshot,
  type ScanLastResultResponse,
} from "@mimimilli/shared";

export const SCAN_QUERY_KEYS = {
  last: () => ["scan", "last"] as const,
} as const;

export type { ScanResult } from "./model";

export class ScanAlreadyActiveError extends ApiRequestError {
  readonly active: ScanJobSnapshot;

  constructor(active: ScanJobSnapshot) {
    super(409, "conflict", "スキャンは既に実行中です");
    this.active = active;
  }
}

async function parse<T>(
  res: Response,
  schema: { safeParse(value: unknown): { success: boolean; data?: T } },
  method: string,
  path: string,
): Promise<T> {
  const body = await res.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (parsed.success) return parsed.data!;
  throw new ApiResponseSchemaError(method, path, []);
}

export async function startScan(): Promise<ScanJobSnapshot> {
  const res = await fetch(`${API_BASE}/scan`, { method: "POST" });
  if (res.status === 409) {
    const body = await res.json().catch(() => null);
    const conflict = scanConflictResponseSchema.safeParse(body);
    if (conflict.success) throw new ScanAlreadyActiveError(conflict.data.active);
  }
  if (!res.ok) throw new ApiRequestError(res.status, "request_failed", `POST /scan: ${res.status}`);
  return (await parse(res, startScanResponseSchema, "POST", "/scan")).job;
}

export async function getActiveScan(): Promise<ScanJobSnapshot | null> {
  const res = await fetch(`${API_BASE}/scan/active`);
  if (res.status === 204) return null;
  if (!res.ok)
    throw new ApiRequestError(res.status, "request_failed", `GET /scan/active: ${res.status}`);
  return parse(res, scanJobSnapshotSchema, "GET", "/scan/active");
}

export async function getScanJob(id: string): Promise<ScanJobSnapshot> {
  const res = await fetch(`${API_BASE}/scan/${encodeURIComponent(id)}`);
  if (!res.ok)
    throw new ApiRequestError(res.status, "request_failed", `GET /scan/${id}: ${res.status}`);
  return parse(res, scanJobSnapshotSchema, "GET", `/scan/${id}`);
}

export async function cancelScan(id: string): Promise<ScanJobSnapshot> {
  const res = await fetch(`${API_BASE}/scan/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok)
    throw new ApiRequestError(res.status, "request_failed", `DELETE /scan/${id}: ${res.status}`);
  return parse(res, scanJobSnapshotSchema, "DELETE", `/scan/${id}`);
}

/** サーバー起動後に一度でも完了したスキャンの結果（TASK-56）。一度も完了していなければnull。 */
export async function getLastScanResult(): Promise<ScanLastResultResponse | null> {
  const res = await fetch(`${API_BASE}/scan/last`);
  if (res.status === 204) return null;
  if (!res.ok)
    throw new ApiRequestError(res.status, "request_failed", `GET /scan/last: ${res.status}`);
  return parse(res, scanLastResultResponseSchema, "GET", "/scan/last");
}
