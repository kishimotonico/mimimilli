// work entity の API。単一作品の取得・更新と、作品に紐づくリソース（カバー画像・音声・
// ファイル一覧・DLsite メタデータ）を扱う。
// 依存方向: shared/api/http と自 entity の model のみを参照する。

import {
  API_BASE,
  getParsed,
  patchParsed,
  postParsed,
  postVoid,
  deleteParsed,
} from "../../shared/api/http";
import {
  workSchema,
  tagListSchema,
  dlsiteWorkInfoSchema,
  dlsiteBulkStartResponseSchema,
  dlsiteBulkCancelResponseSchema,
  fileEntrySchema,
  type Work,
  dlsiteNotificationPageSchema,
  dlsiteNotificationSummarySchema,
  dlsiteParseFailedNotificationPageSchema,
  type DlsiteNotificationPage,
  type DlsiteNotificationSummary,
  type DlsiteParseFailedNotificationPage,
  type WorkPatch,
  type FileEntry,
  type DlsiteWorkInfo,
  type DlsiteApplyBody,
  type DlsiteStatePatch,
  type ResumeBody,
} from "@mimimilli/shared";

/** GET /works/:id は存在しない場合404を返す契約。呼び出し側はnull分岐でなくエラー（TanStack QueryのisError等）で扱う */
export async function getWork(id: string): Promise<Work> {
  return getParsed(workSchema, `/works/${encodeURIComponent(id)}`);
}

export async function getDlsiteNotificationSummary(): Promise<DlsiteNotificationSummary> {
  return getParsed(dlsiteNotificationSummarySchema, "/dlsite/notifications");
}

export async function queryDlsiteNotifications(
  kind: "rj-missing" | "fetch-failed",
  params: { page: number; limit: number },
): Promise<DlsiteNotificationPage> {
  const query = new URLSearchParams({ page: String(params.page), limit: String(params.limit) });
  return getParsed(dlsiteNotificationPageSchema, `/dlsite/notifications/${kind}?${query}`);
}

export async function queryDlsiteParseFailedNotifications(params: {
  page: number;
  limit: number;
}): Promise<DlsiteParseFailedNotificationPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  return getParsed(
    dlsiteParseFailedNotificationPageSchema,
    `/dlsite/notifications/parse-failed?${query}`,
  );
}

export async function patchWork(workId: string, body: WorkPatch): Promise<Work> {
  return patchParsed(workSchema, `/works/${encodeURIComponent(workId)}`, body);
}

export async function getAllTags(): Promise<string[]> {
  return getParsed(tagListSchema, "/tags");
}

/** カバー画像のURLを返す（<img src> で直接使用可）。
 *  width を指定すると `?w=` でサムネイル幅を要求する（サーバー側で許可幅へ正規化される） */
export function getCoverImageUrl(workId: string, width?: number): string {
  const query = width === undefined ? "" : `?w=${encodeURIComponent(width)}`;
  return `${API_BASE}/media/cover/${encodeURIComponent(workId)}${query}`;
}

/** 音声ファイルのURLを返す（<audio src> で直接使用可） */
export function getAudioUrl(workId: string, relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/media/audio/${encodeURIComponent(workId)}/${encoded}`;
}

/** 物理ファイル（画像・PDF・テキスト等）のURLを返す（<img src> 等で直接使用可） */
export function getFileUrl(workId: string, relativePath: string): string {
  const encoded = relativePath.split("/").map(encodeURIComponent).join("/");
  return `${API_BASE}/media/file/${encodeURIComponent(workId)}/${encoded}`;
}

export async function updateLastPlayed(workId: string): Promise<void> {
  await postVoid(`/works/${encodeURIComponent(workId)}/last-played`);
}

export async function saveResumePosition(workId: string, resume: ResumeBody): Promise<void> {
  await postVoid(`/works/${encodeURIComponent(workId)}/resume`, resume);
}

/** GET /works/:id/files も存在しない場合404を返す契約なので、getWork同様にnull分岐は伝播させない（現状未使用） */
export async function listWorkFiles(workId: string): Promise<FileEntry> {
  return getParsed(fileEntrySchema, `/works/${encodeURIComponent(workId)}/files`);
}

export async function fetchDlsiteInfo(workId: string): Promise<DlsiteWorkInfo> {
  return postParsed(dlsiteWorkInfoSchema, `/dlsite/${encodeURIComponent(workId)}/fetch`);
}

export async function applyDlsiteInfo(workId: string, body: DlsiteApplyBody): Promise<void> {
  await postVoid(`/dlsite/${encodeURIComponent(workId)}/apply`, body);
}

export async function updateDlsiteState(workId: string, body: DlsiteStatePatch): Promise<Work> {
  return patchParsed(workSchema, `/dlsite/${encodeURIComponent(workId)}`, body);
}

export async function startDlsiteBulk(): Promise<void> {
  await postParsed(dlsiteBulkStartResponseSchema, "/dlsite/bulk");
}

export async function cancelDlsiteBulk(): Promise<void> {
  await deleteParsed(dlsiteBulkCancelResponseSchema, "/dlsite/bulk");
}
