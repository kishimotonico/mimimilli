// 条件の木による作品一覧・グループの値一覧・件数（fixture アダプタの評価。real は SQL で同じ意味を返す）。
import type { GroupValueItem, Condition, WorkSummary } from "@mimimilli/shared";
import { buildGroupValues } from "./groupValues.ts";
import type {
  ConditionGroupQuery,
  ConditionWorksQuery,
  EvalContext,
} from "../adapter/condition.ts";
import { createMatcher } from "./condition.ts";
import {
  computeCollectionStats,
  sortWorkSummaries,
  worksOrderOf,
  type WorkSummaryPage,
} from "./worksQuery.ts";

export function queryWorksByCondition(
  works: WorkSummary[],
  query: ConditionWorksQuery,
  ctx: EvalContext,
): WorkSummaryPage {
  const idSet = query.ids === undefined ? null : new Set(query.ids);
  const matches = createMatcher(query.condition, ctx);
  const matched = works.filter((work) => (idSet === null || idSet.has(work.id)) && matches(work));
  const sorted = sortWorkSummaries(matched, worksOrderOf(query.sort, query.seed));
  const start = (query.page - 1) * query.limit;
  return {
    items: sorted.slice(start, start + query.limit),
    total: sorted.length,
    stats: computeCollectionStats(sorted),
  };
}

export function groupWorksByCondition(
  works: WorkSummary[],
  query: ConditionGroupQuery,
  ctx: EvalContext,
): GroupValueItem[] {
  return buildGroupValues(
    query.groupBy,
    works.filter(createMatcher(query.condition, ctx)),
    query.groupSort,
  );
}

export function countWorksByConditions(
  works: WorkSummary[],
  conditions: Condition[],
  ctx: EvalContext,
): number[] {
  return conditions.map((condition) => works.filter(createMatcher(condition, ctx)).length);
}
