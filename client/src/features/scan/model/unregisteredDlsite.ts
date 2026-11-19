import {
  canonicalDlsiteProductCode,
  type DlsiteCachedCover,
  type DlsiteProductSummary,
  type ScanCandidate,
} from "@mimimilli/shared";
import type { DlsiteJobState } from "../../../entities/dlsite/model/dlsiteJobStore";

export type CandidateDlsiteDisplay =
  | { state: "none" }
  | { state: "fetching" }
  | { state: "fetched"; title: string | null; cover: DlsiteCachedCover | null }
  | { state: "not_found" }
  | { state: "failed" };

type DisplayJobState = Pick<DlsiteJobState, "job" | "pendingSingles" | "results">;

function displayOf(summary: DlsiteProductSummary): CandidateDlsiteDisplay {
  return summary.state === "fetched"
    ? { state: "fetched", title: summary.title, cover: summary.cover }
    : { state: summary.state };
}

/** 取得中はジョブの状態から、それ以外は候補の値とジョブで見た終端の結果のうち revision の大きい方から出す。
 *  同じ revision なら候補を採る（候補は結果を読んだ後に組み立てられている） */
export function candidateDlsiteDisplay(
  candidate: ScanCandidate,
  job: DisplayJobState,
): CandidateDlsiteDisplay {
  if (candidate.rjCode === null) return { state: "none" };
  const code = canonicalDlsiteProductCode(candidate.rjCode);
  if (job.pendingSingles.has(code)) return { state: "fetching" };

  const entry = job.job?.codes.get(code);
  if (
    entry &&
    job.job?.status === "running" &&
    (entry.state === "queued" || entry.state === "fetching")
  ) {
    return { state: "fetching" };
  }

  const result = job.results.get(code);
  if (result && result.revision > candidate.dlsiteRevision) return displayOf(result.dlsite);
  return displayOf(candidate.dlsite);
}
