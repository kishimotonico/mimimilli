// smart-folder entity の API。スマートフォルダーの CRUD と作品評価を扱う。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  worksPageSchema,
  smartFolderSchema,
  smartFolderListSchema,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderUpdate,
  type WorksPage,
} from "@mimimilli/shared";

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
