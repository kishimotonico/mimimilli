// library feature の API。作品検索（v1/v2）、分類軸ファセット、スマートフォルダー、
// 検索プリセット、ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { get, post, put, del } from "../../shared/api/http";
import type { WorkSummary } from "../../entities/work/model";
import type { AxisFacetItem, SmartFolder, SearchPreset } from "./model/types";

export async function searchWorks(
  query: string,
  tagFilters: string[]
): Promise<WorkSummary[]> {
  const params = new URLSearchParams({ q: query });
  if (tagFilters.length > 0) params.set("tags", tagFilters.join(","));
  return get<WorkSummary[]>(`/works?${params}`);
}

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

export async function createSmartFolder(
  data: { name: string; rules: SmartFolder["rules"]; sort: string }
): Promise<SmartFolder> {
  return post<SmartFolder>("/library/smart-folders", data);
}

export async function updateSmartFolder(
  id: string,
  data: { name?: string; rules?: SmartFolder["rules"]; sort?: string }
): Promise<void> {
  await put(`/library/smart-folders/${encodeURIComponent(id)}`, data);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await del(`/library/smart-folders/${encodeURIComponent(id)}`);
}

export async function evalSmartFolder(id: string): Promise<WorkSummary[]> {
  return get<WorkSummary[]>(`/library/smart-folders/${encodeURIComponent(id)}/works`);
}

// ── 検索プリセット ────────────────────────────────────────────

export async function saveSearchPreset(
  name: string,
  query: string,
  tagFilters: string[],
  sortId: string
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
