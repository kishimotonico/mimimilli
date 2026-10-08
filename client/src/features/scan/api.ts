// scan feature の API。スキャン候補の除外。
// 依存方向: shared/api/http・entities/scan（候補除外の一覧・解除）と自 feature の model のみを参照する。

import { postVoid } from "../../shared/api/http";
import { SCAN_QUERY_KEYS } from "../../entities/scan/queryKeys";
import type { StartScanRequest } from "@mimimilli/shared";
import { scanCandidatesMutationSchema } from "@mimimilli/shared";

export { SCAN_QUERY_KEYS };

export type { ScanResult } from "./model";
export type { StartScanRequest };

export async function excludeScanCandidates(paths: string[]): Promise<void> {
  await postVoid("/scan/candidates/exclude", scanCandidatesMutationSchema.parse({ paths }));
}
