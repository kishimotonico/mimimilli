// 条件の木の SQL コンパイル（ADR-0040）。core の matchCondition と同じ意味表に従う。
// 各葉は CASE WHEN … THEN 1 ELSE 0 END で必ず 0 か 1 を返し、その上に NOT・AND・OR を組む。
import type { Condition } from "@mimimilli/shared";
import { japaneseSortKey } from "../../core/japaneseSortKey.ts";
import type { EvalContext } from "../../adapter/condition.ts";
import { withinDaysCutoff } from "../../core/condition.ts";
import { textSearchCondition } from "./workQuerySql.ts";

export interface SqlFragment {
  sql: string;
  bindings: Array<string | number>;
}

function tagExists(whereSql: string, binding: string): SqlFragment {
  return {
    sql: `EXISTS (
      SELECT 1
      FROM main.work_tags AS cond_work_tags
      INNER JOIN main.tags AS cond_tags ON cond_tags.id = cond_work_tags.tag_id
      WHERE cond_work_tags.work_id = works.id AND ${whereSql}
    )`,
    bindings: [binding],
  };
}

function leaf(condition: Exclude<Condition, { type: "and" | "or" | "not" }>, ctx: EvalContext) {
  switch (condition.type) {
    case "tag":
      return tagExists("cond_tags.name = ?", condition.tag);
    case "hasPrefix":
      return tagExists(
        "instr(cond_tags.name, '/') > 0 AND substr(cond_tags.name, 1, instr(cond_tags.name, '/') - 1) = ?",
        condition.prefix,
      );
    case "duration":
      return {
        sql: `works.total_duration_sec ${condition.op === "gte" ? ">=" : "<="} ?`,
        bindings: [condition.sec],
      };
    case "bookmarked":
      return { sql: "work_states.bookmarked = 1", bindings: [] };
    case "played":
      return condition.withinDays === undefined
        ? { sql: "work_states.last_played_at IS NOT NULL", bindings: [] }
        : {
            sql: "work_states.last_played_at >= ?",
            bindings: [withinDaysCutoff(ctx.now, condition.withinDays)],
          };
    case "added":
      return {
        sql: "work_states.added_at >= ?",
        bindings: [withinDaysCutoff(ctx.now, condition.withinDays)],
      };
    case "addedYear":
      return { sql: "substr(work_states.added_at, 1, 4) = ?", bindings: [condition.year] };
    case "hasError":
      return { sql: "works.status != 'ok'", bindings: [] };
    case "text": {
      if (condition.q === "") return { sql: "1", bindings: [] };
      return textSearchCondition(japaneseSortKey(condition.q), condition.q);
    }
  }
}

function join(operator: "AND" | "OR", identity: "1" | "0", parts: SqlFragment[]): SqlFragment {
  if (parts.length === 0) return { sql: identity, bindings: [] };
  return {
    sql: `(${parts.map((part) => part.sql).join(` ${operator} `)})`,
    bindings: parts.flatMap((part) => part.bindings),
  };
}

/** 0 か 1 を返す式。works と work_states（user.work_states）が FROM にあることが前提 */
export function compileCondition(condition: Condition, ctx: EvalContext): SqlFragment {
  switch (condition.type) {
    case "and":
      return join(
        "AND",
        "1",
        condition.children.map((child) => compileCondition(child, ctx)),
      );
    case "or":
      return join(
        "OR",
        "0",
        condition.children.map((child) => compileCondition(child, ctx)),
      );
    case "not": {
      const inner = compileCondition(condition.child, ctx);
      return { sql: `(NOT ${inner.sql})`, bindings: inner.bindings };
    }
    default: {
      const fragment = leaf(condition, ctx);
      return { sql: `(CASE WHEN ${fragment.sql} THEN 1 ELSE 0 END)`, bindings: fragment.bindings };
    }
  }
}
