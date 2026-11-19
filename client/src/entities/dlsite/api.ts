// DLsite取得ジョブの開始・現在状態・まとめての中止。進捗はSSE（DLSITE_JOB_EVENTS_URL）で受ける。
import {
  dlsiteJobCancelBulkResponseSchema,
  dlsiteJobCurrentResponseSchema,
  dlsiteJobStartBodySchema,
  dlsiteJobStartResponseSchema,
  type DlsiteJobCancelBulkResponse,
  type DlsiteJobSnapshot,
  type DlsiteJobStartBody,
  type DlsiteJobStartResponse,
} from "@mimimilli/shared";
import { API_BASE, deleteParsed, getParsed, postParsed } from "../../shared/api/http";

export const DLSITE_JOB_EVENTS_URL = `${API_BASE}/dlsite/jobs/events`;

export function startDlsiteJob(body: DlsiteJobStartBody): Promise<DlsiteJobStartResponse> {
  return postParsed(
    dlsiteJobStartResponseSchema,
    "/dlsite/jobs",
    dlsiteJobStartBodySchema.parse(body),
  );
}

export async function getCurrentDlsiteJob(): Promise<DlsiteJobSnapshot | null> {
  const { job } = await getParsed(dlsiteJobCurrentResponseSchema, "/dlsite/jobs/current");
  return job;
}

export function cancelDlsiteJobBulk(jobId: string): Promise<DlsiteJobCancelBulkResponse> {
  return deleteParsed(
    dlsiteJobCancelBulkResponseSchema,
    `/dlsite/jobs/${encodeURIComponent(jobId)}/bulk`,
  );
}
