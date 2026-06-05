// work entity の API。単一作品の取得・更新と、作品に紐づくリソース（カバー画像・音声・
// ファイル一覧・DLsite メタデータ）を扱う。
// 依存方向: shared/api/http と自 entity の model のみを参照する。

import { API_BASE, get, post, put } from "../../shared/api/http";
import type { Work, WorkSummary, FileEntry, DlsiteWorkInfo } from "./model";

export async function getAllWorks(): Promise<WorkSummary[]> {
  return get<WorkSummary[]>("/works");
}

export async function getWork(id: string): Promise<Work | null> {
  return get<Work | null>(`/works/${encodeURIComponent(id)}`);
}

export async function updateWorkTags(workId: string, tags: string[]): Promise<void> {
  await put(`/works/${encodeURIComponent(workId)}/tags`, { tags });
}

export async function updateWorkTitle(workId: string, title: string): Promise<void> {
  await put(`/works/${encodeURIComponent(workId)}/title`, { title });
}

export async function getAllTags(): Promise<string[]> {
  return get<string[]>("/tags");
}

/** カバー画像のURLを返す（<img src> で直接使用可） */
export function getCoverImageUrl(workId: string): string {
  return `${API_BASE}/works/${encodeURIComponent(workId)}/cover`;
}

/** 音声ファイルのURLを返す（<audio src> で直接使用可） */
export function getAudioUrl(workId: string, relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${API_BASE}/audio/${encodeURIComponent(workId)}/${encoded}`;
}

/** 物理ファイル（画像・PDF・テキスト等）のURLを返す（<img src> 等で直接使用可） */
export function getFileUrl(workId: string, relativePath: string): string {
  const encoded = relativePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${API_BASE}/files/${encodeURIComponent(workId)}/${encoded}`;
}

export async function toggleBookmark(workId: string): Promise<boolean> {
  const r = await post<{ bookmarked: boolean }>(
    `/works/${encodeURIComponent(workId)}/bookmark`
  );
  return r.bookmarked;
}

export async function updateLastPlayed(workId: string): Promise<void> {
  await post(`/works/${encodeURIComponent(workId)}/last-played`);
}

export async function saveResumePosition(
  workId: string,
  position: number,
  trackIndex: number
): Promise<void> {
  await post(`/works/${encodeURIComponent(workId)}/resume`, {
    position,
    trackIndex,
  });
}

export async function listWorkFiles(workId: string): Promise<FileEntry | null> {
  return get<FileEntry | null>(`/works/${encodeURIComponent(workId)}/files`);
}

export async function fetchDlsiteInfo(workId: string): Promise<DlsiteWorkInfo> {
  return post<DlsiteWorkInfo>(`/dlsite/${encodeURIComponent(workId)}/fetch`);
}

export async function applyDlsiteInfo(
  workId: string,
  info: DlsiteWorkInfo,
  applyTitle: boolean,
  applyTags: boolean,
  applyCover: boolean
): Promise<void> {
  await post(`/dlsite/${encodeURIComponent(workId)}/apply`, {
    info,
    applyTitle,
    applyTags,
    applyCover,
  });
}
