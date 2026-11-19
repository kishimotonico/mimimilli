// scan feature の API。スキャン候補の除外・RJコードの修正。
// 依存方向: shared/api/http・entities/scan（候補除外の一覧・解除）と自 feature の model のみを参照する。

import { postParsed, postVoid } from "../../shared/api/http";
import { SCAN_QUERY_KEYS } from "../../entities/scan/queryKeys";
import type { ScanCandidate, StartScanRequest } from "@mimimilli/shared";
import {
  scanCandidateRjCodeRequestSchema,
  scanCandidateRjCodeResponseSchema,
  scanCandidatesMutationSchema,
} from "@mimimilli/shared";

export { SCAN_QUERY_KEYS };

export type { ScanResult } from "./model";
export type { StartScanRequest };

export async function excludeScanCandidates(paths: string[]): Promise<void> {
  await postVoid("/scan/candidates/exclude", scanCandidatesMutationSchema.parse({ paths }));
}

/** 候補のRJコードを直す。空文字はRJコードなしの明示。直したあとの候補（DLsite状態つき）を返す。 */
export async function setScanCandidateRjCode(
  path: ScanCandidate["path"],
  rjCode: string,
): Promise<ScanCandidate> {
  const { candidate } = await postParsed(
    scanCandidateRjCodeResponseSchema,
    "/scan/candidates/rj-code",
    scanCandidateRjCodeRequestSchema.parse({ path, rjCode }),
  );
  return candidate;
}
