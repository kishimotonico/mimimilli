// DLsite取得ジョブの開始・現在状態・中止。進捗はSSE（DLSITE_JOB_EVENTS_URL）で受ける。
import {
  dlsiteJobCancelResponseSchema,
  dlsiteJobStateSchema,
  dlsiteJobStartBodySchema,
  type DlsiteJobCancelResponse,
  type DlsiteJobStartBody,
  type DlsiteJobState,
} from "@mimimilli/shared";
import { API_BASE, deleteParsed, getParsed, postParsed } from "../../shared/api/http";

export const DLSITE_JOB_EVENTS_URL = `${API_BASE}/dlsite/jobs/events`;

export function startDlsiteJob(body: DlsiteJobStartBody): Promise<DlsiteJobState> {
  return postParsed(dlsiteJobStateSchema, "/dlsite/jobs", dlsiteJobStartBodySchema.parse(body));
}

export function getCurrentDlsiteJob(): Promise<DlsiteJobState> {
  return getParsed(dlsiteJobStateSchema, "/dlsite/jobs/current");
}

export function cancelDlsiteJob(jobId: string): Promise<DlsiteJobCancelResponse> {
  return deleteParsed(dlsiteJobCancelResponseSchema, `/dlsite/jobs/${encodeURIComponent(jobId)}`);
}
