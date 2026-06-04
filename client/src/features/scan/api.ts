// scan feature の API。ライブラリのスキャン実行。
// 依存方向: shared/api/http と自 feature の model のみを参照する。

import { post } from "../../shared/api/http";
import type { ScanResult } from "./model";

export type { ScanResult } from "./model";

export async function scanLibrary(): Promise<ScanResult> {
  return post<ScanResult>("/scan");
}
