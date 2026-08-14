// 候補除外の一覧・解除。features/scan（除外操作・直後の取り消しトースト）と
// features/settings（後から気づいた場合の解除UI、TASK-330）の両方から参照される
// 横断的なAPIのため entities に置く。
import { getParsed, postVoid } from "../../shared/api/http";
import {
  scanCandidateExclusionsResponseSchema,
  scanCandidatesMutationSchema,
} from "@mimimilli/shared";

export const SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY = ["scan", "candidates", "exclusions"] as const;

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
