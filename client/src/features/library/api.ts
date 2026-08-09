// library feature の API。作品検索、分類軸ファセット、ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { getParsed, postParsed } from "../../shared/api/http";
import {
  worksPageSchema,
  axisFacetListSchema,
  exportResponseSchema,
  type AxisFacetItem,
  type FacetAxisId,
  type ExportResponse,
  type WorksPage,
  type WorksQueryInput,
} from "@mimimilli/shared";

// ── 作品検索（GET /api/works）────────────────────────────────

function appendTagsTagOp(
  params: URLSearchParams,
  filter: { tags?: string[]; tagOp?: "AND" | "OR" },
): void {
  for (const tag of filter.tags ?? []) params.append("tags", tag);
  if (filter.tagOp) params.set("tagOp", filter.tagOp);
}

export async function searchWorks(
  params: WorksQueryInput,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  appendTagsTagOp(p, params);
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
  appendTagsTagOp(p, filter);
  const q = p.toString();
  return getParsed(axisFacetListSchema, `/axes/${encodeURIComponent(axis)}${q ? `?${q}` : ""}`);
}

// ── エクスポート ──────────────────────────────────────────────

export async function exportLibrary(): Promise<ExportResponse> {
  return postParsed(exportResponseSchema, "/export");
}
