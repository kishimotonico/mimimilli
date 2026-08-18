// 候補一覧・除外の一覧・解除。features/scan と features/settings の両方から参照される共通API。
import { getParsed, postVoid } from "../../shared/api/http";
import {
  scanCandidateExclusionsResponseSchema,
  scanCandidatesMutationSchema,
} from "@mimimilli/shared";
import { SCAN_CANDIDATES_QUERY_KEY } from "./scanCandidatesCache";

/** exclusionsはcandidatesの子キーなので、candidatesを無効化すれば連動して無効化される。 */
export const SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY = [
  ...SCAN_CANDIDATES_QUERY_KEY,
  "exclusions",
] as const;

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
