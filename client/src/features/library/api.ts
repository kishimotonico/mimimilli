// library feature の API。ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { postParsed } from "../../shared/api/http";
import { exportResponseSchema, type ExportResponse } from "@mimimilli/shared";

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<ExportResponse> {
  return postParsed(exportResponseSchema, "/export");
}
