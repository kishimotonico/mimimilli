import type { Work, WorkSummary, ScanResult, SearchPreset, FileEntry, DlsiteWorkInfo, AxisFacetItem, SmartFolder } from "./types";

const API_BASE = "/api";

export interface Settings {
  rootFolder: string | null;
  lastScanTime: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error(`API error ${res.status}: GET ${path}`);
  return res.json();
}

async function post<T = void>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`API error ${res.status}: POST ${path}`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function put(path: string, body: unknown): Promise<void> {
  const res = await fetch(API_BASE + path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error ${res.status}: PUT ${path}`);
}

async function del(path: string): Promise<void> {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok) throw new Error(`API error ${res.status}: DELETE ${path}`);
}

export async function getRootFolder(): Promise<string | null> {
  const s = await getSettings();
  return s.rootFolder;
}

export async function getSettings(): Promise<Settings> {
  return get<Settings>("/settings");
}

export async function setRootFolder(path: string): Promise<void> {
  await post("/settings", { rootFolder: path });
}

export async function scanLibrary(): Promise<ScanResult> {
  return post<ScanResult>("/scan");
}

export async function getAllWorks(): Promise<WorkSummary[]> {
  return get<WorkSummary[]>("/works");
}

export async function getWork(id: string): Promise<Work | null> {
  return get<Work | null>(`/works/${encodeURIComponent(id)}`);
}

export async function searchWorks(
  query: string,
  tagFilters: string[]
): Promise<WorkSummary[]> {
  const params = new URLSearchParams({ q: query });
  if (tagFilters.length > 0) params.set("tags", tagFilters.join(","));
  return get<WorkSummary[]>(`/works?${params}`);
}

export async function updateWorkTags(
  workId: string,
  tags: string[]
): Promise<void> {
  await put(`/works/${encodeURIComponent(workId)}/tags`, { tags });
}

export async function updateWorkTitle(
  workId: string,
  title: string
): Promise<void> {
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

export async function getLastScanTime(): Promise<string | null> {
  const s = await getSettings();
  return s.lastScanTime;
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

export async function saveSearchPreset(
  name: string,
  query: string,
  tagFilters: string[],
  sortId: string
): Promise<number> {
  const r = await post<{ id: number }>("/presets", {
    name,
    query,
    tagFilters,
    sortId,
  });
  return r.id;
}

export async function getSearchPresets(): Promise<SearchPreset[]> {
  return get<SearchPreset[]>("/presets");
}

export async function deleteSearchPreset(id: number): Promise<void> {
  await del(`/presets/${id}`);
}

export async function listWorkFiles(workId: string): Promise<FileEntry | null> {
  return get<FileEntry | null>(`/works/${encodeURIComponent(workId)}/files`);
}

export async function exportLibrary(): Promise<string> {
  const r = await post<{ data: string }>("/export");
  return r.data;
}

// ── Library v2 API ───────────────────────────────────────────

export interface WorksQueryParams {
  q?: string;
  tags?: string[];
  tagOp?: "AND" | "OR";
  axis?: string;
  axisValue?: string;
  view?: string;
  sort?: string;
}

export async function searchWorksV2(params: WorksQueryParams): Promise<WorkSummary[]> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tags?.length) p.set("tags", params.tags.join(","));
  if (params.tagOp) p.set("tagOp", params.tagOp);
  if (params.axis) p.set("axis", params.axis);
  if (params.axisValue) p.set("axisValue", params.axisValue);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  return get<WorkSummary[]>(`/works?${p}`);
}

export async function getAxisFacets(axis: string): Promise<AxisFacetItem[]> {
  return get<AxisFacetItem[]>(`/library/axes/${encodeURIComponent(axis)}`);
}

export async function listSmartFolders(): Promise<SmartFolder[]> {
  return get<SmartFolder[]>("/library/smart-folders");
}

export async function createSmartFolder(data: { name: string; rules: SmartFolder["rules"]; sort: string }): Promise<SmartFolder> {
  return post<SmartFolder>("/library/smart-folders", data);
}

export async function updateSmartFolder(id: string, data: { name?: string; rules?: SmartFolder["rules"]; sort?: string }): Promise<void> {
  await put(`/library/smart-folders/${encodeURIComponent(id)}`, data);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await del(`/library/smart-folders/${encodeURIComponent(id)}`);
}

export async function evalSmartFolder(id: string): Promise<WorkSummary[]> {
  return get<WorkSummary[]>(`/library/smart-folders/${encodeURIComponent(id)}/works`);
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
