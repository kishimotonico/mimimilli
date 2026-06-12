// library feature の API。作品検索（v2）、分類軸ファセット、スマートフォルダー、
// 検索プリセット、ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { get, post, put, del } from "../../shared/api/http";
import type {
  AxisFacetItem,
  FacetAxis,
  SearchPreset,
  SmartFolder,
  SmartFolderCreate,
  SmartFolderUpdate,
  SortId,
  ViewId,
  WorksPage,
  WorkSummary,
} from "@mimikago/shared";

// ── 作品検索（GET /api/works）────────────────────────────────

export interface WorksQueryParams {
  q?: string;
  tags?: string[];
  tagOp?: "AND" | "OR";
  axis?: FacetAxis;
  axisValue?: string;
  view?: ViewId;
  sort?: SortId;
  page?: number;
  limit?: number;
}

export async function searchWorks(params: WorksQueryParams): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.tags?.length) p.set("tags", params.tags.join(","));
  if (params.tagOp) p.set("tagOp", params.tagOp);
  if (params.axis) p.set("axis", params.axis);
  if (params.axisValue) p.set("axisValue", params.axisValue);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.limit !== undefined) p.set("limit", String(params.limit));
  const q = p.toString();
  return get<WorksPage>(`/works${q ? `?${q}` : ""}`);
}

// ── 分類軸ファセット ───────────────────────────────────────────

export async function getAxisFacets(axis: FacetAxis): Promise<AxisFacetItem[]> {
  return get<AxisFacetItem[]>(`/axes/${encodeURIComponent(axis)}`);
}

// ── スマートフォルダー ────────────────────────────────────────

export async function listSmartFolders(): Promise<SmartFolder[]> {
  return get<SmartFolder[]>("/smart-folders");
}

export async function createSmartFolder(data: SmartFolderCreate): Promise<SmartFolder> {
  return post<SmartFolder>("/smart-folders", data);
}

export async function updateSmartFolder(id: string, data: SmartFolderUpdate): Promise<SmartFolder> {
  return put<SmartFolder>(`/smart-folders/${encodeURIComponent(id)}`, data);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await del(`/smart-folders/${encodeURIComponent(id)}`);
}

export async function evalSmartFolder(id: string): Promise<WorkSummary[]> {
  return get<WorkSummary[]>(`/smart-folders/${encodeURIComponent(id)}/works`);
}

// ── 検索プリセット ────────────────────────────────────────────

export async function saveSearchPreset(
  name: string,
  query: string,
  tagFilters: string[],
  sortId: SortId
): Promise<number> {
  const r = await post<{ id: number }>("/presets", { name, query, tagFilters, sortId });
  return r.id;
}

export async function getSearchPresets(): Promise<SearchPreset[]> {
  return get<SearchPreset[]>("/presets");
}

export async function deleteSearchPreset(id: number): Promise<void> {
  await del(`/presets/${id}`);
}

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<string> {
  const r = await post<{ data: string }>("/export");
  return r.data;
}
