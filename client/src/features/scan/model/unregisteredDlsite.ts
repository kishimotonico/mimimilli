import {
  canonicalDlsiteProductCode,
  type DlsiteCachedCover,
  type ScanCandidate,
} from "@mimimilli/shared";
import type { DlsiteJobState } from "../../../entities/dlsite/model/dlsiteJobStore";

export type CandidateDlsiteDisplay =
  | { state: "none" }
  | { state: "fetching" }
  | { state: "fetched"; title: string | null; cover: DlsiteCachedCover | null }
  | { state: "not_found" }
  | { state: "failed" };

type DisplayJobState = Pick<DlsiteJobState, "job" | "pendingSingles" | "settled">;

/** 候補一覧（サーバー）のDLsite状態に、追跡中ジョブのコード状態を重ねた表示状態。
 *  取り直しを間引く間に「取得中 → 空欄 → 取得済み」とちらつかないための重ね方。 */
export function candidateDlsiteDisplay(
  candidate: ScanCandidate,
  job: DisplayJobState,
): CandidateDlsiteDisplay {
  if (candidate.rjCode === null) return { state: "none" };
  const code = canonicalDlsiteProductCode(candidate.rjCode);
  if (job.pendingSingles.has(code)) return { state: "fetching" };

  const entry = job.job?.codes.get(code);
  if (entry && job.job) {
    if (job.job.status === "running" && (entry.state === "queued" || entry.state === "fetching")) {
      return { state: "fetching" };
    }
    if (!job.settled) {
      if (entry.state === "not_found") return { state: "not_found" };
      if (entry.state === "failed") return { state: "failed" };
      if (entry.state === "fetched") {
        const server = candidate.dlsite;
        return server.state === "fetched"
          ? { state: "fetched", title: server.title, cover: server.cover }
          : { state: "fetched", title: null, cover: null };
      }
    }
  }

  const server = candidate.dlsite;
  return server.state === "fetched"
    ? { state: "fetched", title: server.title, cover: server.cover }
    : { state: server.state };
}
