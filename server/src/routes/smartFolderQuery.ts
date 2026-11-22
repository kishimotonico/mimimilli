// スマートフォルダーの作品一覧・値一覧の評価呼び出し（ADR-0040）。
// 基準時刻 now をここで1リクエストにつき1回作ってアダプタへ渡す。検索規則は持たず、
// 木の組み立ては shared の buildEffectiveCondition に任せる。
import {
  buildEffectiveCondition,
  normalizeTag,
  smartFolderGroupsRequestSchema,
  tagSchema,
  smartFolderWorksRequestSchema,
  WORKS_DEFAULT_PAGE_SIZE,
  type GroupValueItem,
  type Condition,
  type GroupBy,
  type SmartFolderGroupsRequest,
  type SmartFolderWorksRequest,
  type WorksPage,
} from "@mimimilli/shared";
import type { DataAdapter } from "../adapter/index.ts";
import { invalidRequest } from "../lib/httpError.ts";

export interface QueriedSmartFolder {
  condition: Condition;
  groupBy: GroupBy | null;
}

/** グループの値を、グループ分けの種類に合わせて検証・正規化する。不正なら 400 */
function selectedGroup(
  folder: QueriedSmartFolder,
  value: string | undefined,
): { by: GroupBy; value: string } | undefined {
  if (value === undefined) return undefined;
  const by = folder.groupBy;
  if (by === null) invalidRequest("グループ分けのないスマートフォルダーです");
  switch (by.kind) {
    case "addedYear":
      if (!/^\d{4}$/.test(value)) invalidRequest("追加年は4桁の年で指定してください");
      return { by, value };
    case "tag":
      return { by, value: validGroupTag(value) };
    case "prefix": {
      const tag = validGroupTag(`${by.prefix}/${value}`);
      if (!tag.startsWith(`${by.prefix}/`)) invalidRequest("グループの値が不正です");
      return { by, value: tag.slice(by.prefix.length + 1) };
    }
  }
}

function validGroupTag(tag: string): string {
  const parsed = tagSchema.safeParse(tag);
  const normalized = parsed.success ? normalizeTag(parsed.data) : null;
  if (normalized === null) invalidRequest("グループの値が不正です");
  return normalized;
}

/** sort=random で seed が無い、契約にないキーを送るなど、契約に合わない要求は 400 */
export function parseSmartFolderWorksRequest(raw: unknown): SmartFolderWorksRequest {
  const parsed = smartFolderWorksRequestSchema.safeParse(raw);
  if (!parsed.success) {
    invalidRequest(parsed.error.issues[0]?.message ?? "スマートフォルダーの要求が不正です");
  }
  return parsed.data;
}

export function parseSmartFolderGroupsRequest(raw: unknown): SmartFolderGroupsRequest {
  const parsed = smartFolderGroupsRequestSchema.safeParse(raw);
  if (!parsed.success) {
    invalidRequest(parsed.error.issues[0]?.message ?? "値一覧の要求が不正です");
  }
  return parsed.data;
}

export async function queryFolderWorks(
  adapter: DataAdapter,
  folder: QueriedSmartFolder,
  request: SmartFolderWorksRequest,
  ids?: string[],
): Promise<WorksPage> {
  const now = Date.now();
  return adapter.queryWorks(
    {
      condition: buildEffectiveCondition({
        condition: folder.condition,
        group: selectedGroup(folder, request.group),
        tags: request.tags,
        q: request.q,
      }),
      ...(ids ? { ids } : {}),
      sort: request.sort,
      seed: request.seed,
      page: request.page ?? 1,
      limit: request.limit ?? WORKS_DEFAULT_PAGE_SIZE,
    },
    { now },
  );
}

export async function queryFolderGroups(
  adapter: DataAdapter,
  folder: QueriedSmartFolder,
  request: SmartFolderGroupsRequest,
): Promise<GroupValueItem[]> {
  const now = Date.now();
  return adapter.groupWorks(
    {
      condition: buildEffectiveCondition({
        condition: folder.condition,
        group: selectedGroup(folder, request.group),
        tags: request.tags,
        q: request.q,
      }),
      groupBy: request.groupBy,
    },
    { now },
  );
}
