// library feature の API。作品検索（v2）、分類軸ファセット、スマートフォルダー、
// ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { getParsed, postParsed, putParsed, del, patchParsed } from "../../shared/api/http";
import {
  worksPageSchema,
  axisFacetListSchema,
  tagPrefixSchema,
  tagPrefixListSchema,
  tagPrefixCandidateListSchema,
  smartFolderSchema,
  smartFolderListSchema,
  workSummaryListSchema,
  exportResponseSchema,
  type AxisFacetItem,
  type FacetAxisId,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderUpdate,
  type SortId,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
  type ViewId,
  type WorksPage,
  type WorkSummary,
} from "@mimimilli/shared";

// ── 作品検索（GET /api/works）────────────────────────────────

export interface WorksQueryParams {
  q?: string;
  tags?: string[];
  tagOp?: "AND" | "OR";
  axis?: FacetAxisId;
  axisValue?: string;
  view?: ViewId;
  sort?: SortId;
  page?: number;
  limit?: number;
}

export async function searchWorks(params: WorksQueryParams): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  for (const tag of params.tags ?? []) p.append("tags", tag);
  if (params.tagOp) p.set("tagOp", params.tagOp);
  if (params.axis) p.set("axis", params.axis);
  if (params.axisValue) p.set("axisValue", params.axisValue);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.limit !== undefined) p.set("limit", String(params.limit));
  const q = p.toString();
  return getParsed(worksPageSchema, `/works${q ? `?${q}` : ""}`);
}

// ── 分類軸ファセット ───────────────────────────────────────────

export async function getAxisFacets(axis: FacetAxisId): Promise<AxisFacetItem[]> {
  return getParsed(axisFacetListSchema, `/axes/${encodeURIComponent(axis)}`);
}

// ── タグ prefix 定義（ADR-0005）──────────────────────────────

export async function listTagPrefixes(): Promise<TagPrefix[]> {
  return getParsed(tagPrefixListSchema, "/tag-prefixes");
}

export async function createTagPrefix(data: TagPrefixCreate): Promise<TagPrefix> {
  return postParsed(tagPrefixSchema, "/tag-prefixes", data);
}

export async function updateTagPrefix(prefix: string, data: TagPrefixUpdate): Promise<TagPrefix> {
  return patchParsed(tagPrefixSchema, `/tag-prefixes/${encodeURIComponent(prefix)}`, data);
}

export async function deleteTagPrefix(prefix: string): Promise<void> {
  await del(`/tag-prefixes/${encodeURIComponent(prefix)}`);
}

export async function listTagPrefixCandidates(): Promise<TagPrefixCandidate[]> {
  return getParsed(tagPrefixCandidateListSchema, "/tag-prefixes/candidates");
}

// ── スマートフォルダー ────────────────────────────────────────

export async function listSmartFolders(): Promise<SmartFolder[]> {
  return getParsed(smartFolderListSchema, "/smart-folders");
}

export async function createSmartFolder(data: SmartFolderCreate): Promise<SmartFolder> {
  return postParsed(smartFolderSchema, "/smart-folders", data);
}

export async function updateSmartFolder(id: string, data: SmartFolderUpdate): Promise<SmartFolder> {
  return putParsed(smartFolderSchema, `/smart-folders/${encodeURIComponent(id)}`, data);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await del(`/smart-folders/${encodeURIComponent(id)}`);
}

export async function evalSmartFolder(id: string): Promise<WorkSummary[]> {
  return getParsed(workSummaryListSchema, `/smart-folders/${encodeURIComponent(id)}/works`);
}

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<string> {
  const r = await postParsed(exportResponseSchema, "/export");
  return r.data;
}
