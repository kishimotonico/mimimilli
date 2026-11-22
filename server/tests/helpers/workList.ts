import type { Condition, SortId, WorksPage } from "@mimimilli/shared";
import type { DataAdapter } from "../../src/adapter/index.ts";

const ALL_WORKS_CONDITION: Condition = { type: "and", children: [] };

/** 条件なしの作品一覧。ページ指定がなければ1ページに収まる件数で取る */
export function listWorks(
  adapter: Pick<DataAdapter, "queryWorks">,
  options: { sort?: SortId; ids?: string[]; page?: number; limit?: number } = {},
): Promise<WorksPage> {
  return adapter.queryWorks(
    {
      condition: ALL_WORKS_CONDITION,
      sort: options.sort ?? "added-desc",
      page: options.page ?? 1,
      limit: options.limit ?? 500,
      ...(options.ids ? { ids: options.ids } : {}),
    },
    { now: Date.now() },
  );
}
