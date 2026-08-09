// library feature の API。作品検索、分類軸ファセット、スマートフォルダー、
// ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { deleteVoid, getParsed, patchParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  worksPageSchema,
  axisFacetListSchema,
  tagPrefixSchema,
  tagPrefixListSchema,
  tagPrefixCandidateListSchema,
  smartFolderSchema,
  smartFolderListSchema,
  exportResponseSchema,
  type AxisFacetItem,
  type FacetAxisId,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderUpdate,
  type TagPrefix,
  type TagPrefixCandidate,
  type TagPrefixCreate,
  type TagPrefixUpdate,
  type ExportResponse,
  type WorksPage,
  type WorksQueryInput,
} from "@mimimilli/shared";

// ── 作品検索（GET /api/works）────────────────────────────────

export async function searchWorks(
  params: WorksQueryInput,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  for (const tag of params.tags ?? []) p.append("tags", tag);
  if (params.tagOp) p.set("tagOp", params.tagOp);
  if (params.view) p.set("view", params.view);
  if (params.sort) p.set("sort", params.sort);
  if (params.seed !== undefined) p.set("seed", String(params.seed));
  if (params.page !== undefined) p.set("page", String(params.page));
  if (params.limit !== undefined) p.set("limit", String(params.limit));
  const q = p.toString();
  return getParsed(worksPageSchema, `/works${q ? `?${q}` : ""}`, options);
}

// ── 分類軸ファセット ───────────────────────────────────────────

/** 自軸除外後のフィルタ。フォルダー評価API同様 tags/tagOp を渡す */
export interface AxisFacetsParams {
  tags?: string[];
  tagOp?: "AND" | "OR";
}

export async function getAxisFacets(
  axis: FacetAxisId,
  filter: AxisFacetsParams = {},
): Promise<AxisFacetItem[]> {
  const p = new URLSearchParams();
  for (const tag of filter.tags ?? []) p.append("tags", tag);
  if (filter.tagOp) p.set("tagOp", filter.tagOp);
  const q = p.toString();
  return getParsed(axisFacetListSchema, `/axes/${encodeURIComponent(axis)}${q ? `?${q}` : ""}`);
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
  await deleteVoid(`/tag-prefixes/${encodeURIComponent(prefix)}`);
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
  await deleteVoid(`/smart-folders/${encodeURIComponent(id)}`);
}

/** tags はフォルダーのルールに対する追加の AND 条件（ADR-0012） */
export interface SmartFolderWorksParams {
  page: number;
  limit: number;
  seed?: number;
  tags?: string[];
  tagOp?: "AND" | "OR";
}

export async function evalSmartFolder(
  id: string,
  params: SmartFolderWorksParams,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  for (const tag of params.tags ?? []) p.append("tags", tag);
  if (params.tagOp) p.set("tagOp", params.tagOp);
  if (params.seed !== undefined) p.set("seed", String(params.seed));
  p.set("page", String(params.page));
  p.set("limit", String(params.limit));
  const q = p.toString();
  return getParsed(
    worksPageSchema,
    `/smart-folders/${encodeURIComponent(id)}/works${q ? `?${q}` : ""}`,
    options,
  );
}

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<ExportResponse> {
  return postParsed(exportResponseSchema, "/export");
}
