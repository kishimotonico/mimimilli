import { SCAN_CANDIDATES_QUERY_KEY } from "./scanCandidatesCache";

/** exclusionsはcandidatesの子キー。候補は enabled:false で、`refreshScanCandidates` 以外では取り直さない。 */
export const SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY = [
  ...SCAN_CANDIDATES_QUERY_KEY,
  "exclusions",
] as const;

export const SCAN_QUERY_KEYS = {
  last: () => ["scan", "last"] as const,
  candidates: () => SCAN_CANDIDATES_QUERY_KEY,
  candidateExclusions: () => SCAN_CANDIDATE_EXCLUSIONS_QUERY_KEY,
  diagnostics: () => ["scan", "diagnostics"] as const,
} as const;
