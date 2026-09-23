// smart-folder entity の API。スマートフォルダーの CRUD と作品評価を扱う。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  worksPageSchema,
  smartFolderPreviewResponseSchema,
  smartFolderSchema,
  smartFolderListSchema,
  type SmartFolder,
  type SmartFolderCreate,
  type SmartFolderRule,
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

/** 未保存のドラフト条件（rules）をチップ絞り込みなしで評価し、一致件数だけ返す
 *  （条件エディタのライブ件数プレビュー・結果バナーの「条件一致」件数） */
export async function previewSmartFolderRuleCount(
  rules: SmartFolderRule[],
  options?: { signal?: AbortSignal },
): Promise<number> {
  const { total } = await postParsed(
    smartFolderPreviewResponseSchema,
    "/smart-folders/preview",
    { rules },
    options,
  );
  return total;
}

/** tags と q はフォルダーのルール（OR・除外を含む）全体に対する追加の AND 条件
 *  （ADR-0012、TASK-462） */
export interface SmartFolderWorksParams {
  page: number;
  limit: number;
  seed?: number;
  q?: string;
  tags?: string[];
  tagOp?: "AND" | "OR";
}

export async function evalSmartFolder(
  id: string,
  params: SmartFolderWorksParams,
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
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
