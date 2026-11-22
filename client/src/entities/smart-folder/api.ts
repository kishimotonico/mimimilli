// smart-folder entity の API（ADR-0040「HTTP の契約」）。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  ALL_SMART_FOLDER_ID,
  groupValueListSchema,
  smartFolderListSchema,
  smartFolderSchema,
  worksPageSchema,
  type GroupSortId,
  type GroupValueItem,
  type GroupBy,
  type ScanRecordKind,
  type WorkChangeKind,
  type SmartFolder,
  type SmartFolderRestore,
  type SmartFolderWrite,
  type SortId,
  type WorksPage,
} from "@mimimilli/shared";

const folderPath = (id: string) => `/smart-folders/${encodeURIComponent(id)}`;

export async function listSmartFolders(): Promise<SmartFolder[]> {
  return getParsed(smartFolderListSchema, "/smart-folders");
}

export async function createSmartFolder(data: SmartFolderWrite): Promise<SmartFolder> {
  return postParsed(smartFolderSchema, "/smart-folders", data);
}

/** 全件の順序を置き換える。応答は並べ替え後の一覧（件数入り） */
export async function reorderSmartFolders(ids: string[]): Promise<SmartFolder[]> {
  return putParsed(smartFolderListSchema, "/smart-folders/order", { ids });
}

/** テンプレートの固定 ID で追加する */
export async function createSmartFolderFromTemplate(templateId: string): Promise<SmartFolder> {
  return postParsed(smartFolderSchema, "/smart-folders/from-template", { templateId });
}

/** 削除した行を同じ ID・位置・作成日時で戻す */
export async function restoreSmartFolder(data: SmartFolderRestore): Promise<SmartFolder> {
  return postParsed(smartFolderSchema, "/smart-folders/restore", data);
}

export async function updateSmartFolder(id: string, data: SmartFolderWrite): Promise<SmartFolder> {
  return putParsed(smartFolderSchema, folderPath(id), data);
}

/** 既定の並びだけを更新する。ほかの列は触らない */
export async function updateSmartFolderSort(id: string, sort: SortId | null): Promise<SmartFolder> {
  return putParsed(smartFolderSchema, `${folderPath(id)}/sort`, { sort });
}

/** 値一覧の既定の並びだけを更新する。ほかの列は触らない */
export async function updateSmartFolderGroupSort(
  id: string,
  groupSort: GroupSortId,
): Promise<SmartFolder> {
  return putParsed(smartFolderSchema, `${folderPath(id)}/group-sort`, { groupSort });
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
  /** スキャン記録の作品だけに絞る（スキャン画面） */
  scanRecord?: ScanRecordKind;
  scanChange?: WorkChangeKind;
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
  if (params.scanRecord) p.set("scanRecord", params.scanRecord);
  if (params.scanChange) p.set("scanChange", params.scanChange);
  return getParsed(worksPageSchema, `${folderPath(id)}/works?${p.toString()}`, options);
}

/** 「すべて」の作品一覧。ライブラリ全体の件数・統計と、スキャン記録の作品の取得に使う */
export async function getAllWorks(
  params: {
    page?: number;
    limit: number;
    scanRecord?: ScanRecordKind;
    scanChange?: WorkChangeKind;
  },
  options?: { signal?: AbortSignal },
): Promise<WorksPage> {
  return getSmartFolderWorks(
    ALL_SMART_FOLDER_ID,
    {
      q: "",
      tags: [],
      group: null,
      sort: "added-desc",
      seed: undefined,
      page: 1,
      ...params,
    },
    options,
  );
}

export interface SmartFolderGroupsParams {
  groupBy: GroupBy;
  groupSort: GroupSortId;
  /** 「＋絞り込み」の候補でだけ使う。自身の値一覧では送らない */
  group?: string | null;
  tags?: string[];
  q?: string;
}

export async function getSmartFolderGroups(
  id: string,
  params: SmartFolderGroupsParams,
): Promise<GroupValueItem[]> {
  const body: Record<string, unknown> = {
    groupBy: params.groupBy,
    groupSort: params.groupSort,
  };
  if (params.group) body.group = params.group;
  if (params.tags && params.tags.length > 0) body.tags = params.tags;
  if (params.q) body.q = params.q;
  return postParsed(groupValueListSchema, `${folderPath(id)}/groups`, body);
}
