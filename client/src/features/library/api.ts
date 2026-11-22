// library feature の API。ライブラリのエクスポート。
// 依存方向: shared/api/http のみを参照する。

import { postParsed } from "../../shared/api/http";
import { exportResponseSchema, type ExportResponse } from "@mimimilli/shared";

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<ExportResponse> {
  return postParsed(exportResponseSchema, "/export");
}
