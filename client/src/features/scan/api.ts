// scan feature の API。ライブラリのスキャン実行。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import { postParsed } from "../../shared/api/http";
import { scanResultSchema, type ScanResult } from "@mimimilli/shared";

export type { ScanResult } from "./model";

export async function scanLibrary(): Promise<ScanResult> {
  return postParsed(scanResultSchema, "/scan");
}
