// smart-folder entity の API（ADR-0040「HTTP の契約」）。
// 依存方向: shared/api/http のみを参照する。

import { deleteVoid, getParsed, patchParsed, postParsed, putParsed } from "../../shared/api/http";
import {
  ALL_SMART_FOLDER_ID,
  groupByKey,
  groupValueListSchema,
  smartFolderCountsSchema,
  smartFolderListSchema,
  smartFolderSchema,
  worksPageSchema,
  type GroupSortId,
  type GroupValueItem,
  type GroupBy,
  type ScanRecordKind,
  type WorkChangeKind,
  type SmartFolder,
  type SmartFolderCounts,
  type SmartFolderCreate,
  type SmartFolderOrder,
  type SmartFolderPatch,
  type SortId,
  type WorksPage,
} from "@mimimilli/shared";

const folderPath = (id: string) => `/smart-folders/${encodeURIComponent(id)}`;

export async function listSmartFolders(options?: { signal?: AbortSignal }): Promise<SmartFolder[]> {
  return getParsed(smartFolderListSchema, "/smart-folders", options);
}

export async function getSmartFolderCounts(options?: {
  signal?: AbortSignal;
}): Promise<SmartFolderCounts> {
  return getParsed(smartFolderCountsSchema, "/smart-folders/counts", options);
}

/** 通常の作成・既定から追加・削除の取り消しのすべてがこの口を通る。id と position を送ると、その行をその位置に作る */
export async function createSmartFolder(data: SmartFolderCreate): Promise<SmartFolder> {
  return postParsed(smartFolderSchema, "/smart-folders", data);
}

/** 全件の順序を置き換える。応答は並べ替え後の一覧 */
export async function reorderSmartFolders(ids: string[]): Promise<SmartFolder[]> {
  return putParsed(smartFolderListSchema, "/smart-folders/order", {
    ids,
  } satisfies SmartFolderOrder);
}

/** 送った列だけを更新する。ほかの列は触らない */
export async function updateSmartFolder(id: string, patch: SmartFolderPatch): Promise<SmartFolder> {
  return patchParsed(smartFolderSchema, folderPath(id), patch);
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

interface SmartFolderGroupsParams {
  groupBy: GroupBy;
  groupSort: GroupSortId;
  /** 値を選んだあとの作品一覧の母集団で候補を数えるときの値 */
  group?: string | null;
  tags?: string[];
  q?: string;
}

export async function getSmartFolderGroups(
  id: string,
  params: SmartFolderGroupsParams,
  options?: { signal?: AbortSignal },
): Promise<GroupValueItem[]> {
  const query = new URLSearchParams({
    groupBy: groupByKey(params.groupBy),
    groupSort: params.groupSort,
  });
  if (params.group) query.set("group", params.group);
  for (const tag of params.tags ?? []) query.append("tags", tag);
  if (params.q) query.set("q", params.q);
  return getParsed(groupValueListSchema, `${folderPath(id)}/groups?${query.toString()}`, options);
}
