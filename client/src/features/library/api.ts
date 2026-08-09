// library feature の API。作品検索、分類軸ファセット、ライブラリのエクスポート。
// 依存方向: shared/api/http、entities/work（戻り値の WorkSummary）、自 feature の model を参照する。

import { getParsed, postParsed } from "../../shared/api/http";
import {
  axisFacetListSchema,
  exportResponseSchema,
  type AxisFacetItem,
  type FacetAxisId,
  type ExportResponse,
} from "@mimimilli/shared";

function appendTagsTagOp(
  params: URLSearchParams,
  filter: { tags?: string[]; tagOp?: "AND" | "OR" },
): void {
  for (const tag of filter.tags ?? []) params.append("tags", tag);
  if (filter.tagOp) params.set("tagOp", filter.tagOp);
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
