// 直近のスキャン結果・現在の診断・候補除外の一覧と解除。features/scan・features/files・features/settings・app から参照される共通API。
import { getParsed, postVoid } from "../../shared/api/http";
import {
  scanCandidateExclusionsResponseSchema,
  scanCandidatesMutationSchema,
  scanDiagnosticsSchema,
  scanLastResultResponseSchema,
  type ScanDiagnostics,
  type ScanLastResultResponse,
} from "@mimimilli/shared";
import { SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY } from "./queryKeys";

export { SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY };

export async function getScanCandidateExclusions(): Promise<string[]> {
  const { paths } = await getParsed(
    scanCandidateExclusionsResponseSchema,
    "/scan/candidates/exclusions",
  );
  return paths;
}

export async function restoreScanCandidateExclusions(paths: string[]): Promise<void> {
  await postVoid(
    "/scan/candidates/exclusions/restore",
    scanCandidatesMutationSchema.parse({ paths }),
  );
}

/** サーバー起動後に一度でも完了したスキャンの実行サマリー。一度も完了していなければnull。 */
export async function getLastScanResult(): Promise<ScanLastResultResponse | null> {
  return getParsed(scanLastResultResponseSchema, "/scan/last", { noContentAsNull: true });
}

/** 要対応の現在の診断（ID重複・読み込めない作品情報ファイル）。スキャン完了時点のスナップショットではない。 */
export async function getScanDiagnostics(): Promise<ScanDiagnostics> {
  return getParsed(scanDiagnosticsSchema, "/scan/diagnostics");
}
