// smart-folder entity の API（ADR-0040「HTTP の契約」）。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  axisFacetListSchema,
  smartFolderItemListSchema,
  smartFolderItemSchema,
  worksPageSchema,
  type AxisFacetItem,
  type GroupBy,
  type SmartFolderItem,
  type SmartFolderWrite,
  type SortId,
  type WorksPage,
} from "@mimimilli/shared";

const folderPath = (id: string) => `/smart-folders/${encodeURIComponent(id)}`;

export async function listSmartFolders(): Promise<SmartFolderItem[]> {
  return getParsed(smartFolderItemListSchema, "/smart-folders");
}

export async function updateSmartFolder(
  id: string,
  data: SmartFolderWrite,
): Promise<SmartFolderItem> {
  return putParsed(smartFolderItemSchema, folderPath(id), data);
}

export async function deleteSmartFolder(id: string): Promise<void> {
  await deleteVoid(folderPath(id));
}

export interface SmartFolderWorksParams {
  q: string;
  tags: string[];
  group: string | null;
  sort: SortId;
  seed: number | undefined;
  page: number;
  limit: number;
}

export async function getSmartFolderWorks(
  id: string,
  params: SmartFolderWorksParams,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  for (const tag of params.tags) p.append("tags", tag);
  if (params.group !== null) p.set("group", params.group);
  p.set("sort", params.sort);
  if (params.sort === "random" && params.seed !== undefined) p.set("seed", String(params.seed));
  p.set("page", String(params.page));
  p.set("limit", String(params.limit));
  return getParsed(worksPageSchema, `${folderPath(id)}/works?${p.toString()}`, options);
}

export interface SmartFolderGroupsParams {
  groupBy: GroupBy;
  /** 「＋絞り込み」の候補でだけ使う。自身の値一覧では送らない */
  group?: string | null;
  tags?: string[];
  q?: string;
}

export async function getSmartFolderGroups(
  id: string,
  params: SmartFolderGroupsParams,
): Promise<AxisFacetItem[]> {
  const body: Record<string, unknown> = { groupBy: params.groupBy };
  if (params.group) body.group = params.group;
  if (params.tags && params.tags.length > 0) body.tags = params.tags;
  if (params.q) body.q = params.q;
  return postParsed(axisFacetListSchema, `${folderPath(id)}/groups`, body);
}
