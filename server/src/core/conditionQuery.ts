// 条件の木による作品一覧・グループの値一覧・件数（fixture アダプタの評価。real は SQL で同じ意味を返す）。
import type { AxisFacetItem, Condition, SortId, WorkSummary } from "@mimimilli/shared";
import { buildGroupFacets } from "./axisFacets.ts";
import type {
  ConditionGroupQuery,
  ConditionWorksQuery,
  EvalContext,
} from "../adapter/condition.ts";
import { createMatcher } from "./condition.ts";
import { computeCollectionStats, sortWorkSummaries, type WorkSummaryPage } from "./worksQuery.ts";

export function requireRandomSeed(sort: SortId, seed: number | undefined): number | undefined {
  if (sort !== "random") return undefined;
  if (seed === undefined) throw new Error("randomソートにはseedが必要です");
  return seed;
}

export function queryWorksByCondition(
  works: WorkSummary[],
  query: ConditionWorksQuery,
  ctx: EvalContext,
): WorkSummaryPage {
  const seed = requireRandomSeed(query.sort, query.seed);
  const idSet = query.ids === undefined ? null : new Set(query.ids);
  const matches = createMatcher(query.condition, ctx);
  const matched = works.filter((work) => (idSet === null || idSet.has(work.id)) && matches(work));
  const sorted = sortWorkSummaries(matched, query.sort, seed);
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
): AxisFacetItem[] {
  return buildGroupFacets(query.groupBy, works.filter(createMatcher(query.condition, ctx)));
}

export function countWorksByConditions(
  works: WorkSummary[],
  conditions: Condition[],
  ctx: EvalContext,
): number[] {
  return conditions.map((condition) => works.filter(createMatcher(condition, ctx)).length);
}
