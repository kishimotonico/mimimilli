// DLsite取得ジョブの開始・現在状態・まとめての中止。進捗はSSE（DLSITE_JOB_EVENTS_URL）で受ける。
import {
  dlsiteJobCancelBulkResponseSchema,
  dlsiteJobStateSchema,
  dlsiteJobStartBodySchema,
  type DlsiteJobCancelBulkResponse,
  type DlsiteJobStartBody,
  type DlsiteJobSnapshot,
} from "@mimimilli/shared";
import { API_BASE, deleteParsed, getParsed, postParsed } from "../../shared/api/http";

export const DLSITE_JOB_EVENTS_URL = `${API_BASE}/dlsite/jobs/events`;

export async function startDlsiteJob(body: DlsiteJobStartBody): Promise<{ jobId: string }> {
  const { job } = await postParsed(
    dlsiteJobStateSchema,
    "/dlsite/jobs",
    dlsiteJobStartBodySchema.parse(body),
  );
  if (!job) throw new Error("DLsite取得ジョブの開始応答にジョブがありません");
  return { jobId: job.jobId };
}

export async function getCurrentDlsiteJob(): Promise<DlsiteJobSnapshot | null> {
  const { job } = await getParsed(dlsiteJobStateSchema, "/dlsite/jobs/current");
  return job;
}

export function cancelDlsiteJobBulk(jobId: string): Promise<DlsiteJobCancelBulkResponse> {
  return deleteParsed(
    dlsiteJobCancelBulkResponseSchema,
    `/dlsite/jobs/${encodeURIComponent(jobId)}/bulk`,
  );
}
