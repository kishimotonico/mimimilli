// スマートフォルダーの条件の木の評価（ADR-0040）。real の compileCondition と同じ意味表に従う。
import {
  EMPTY_CONDITION,
  parseTag,
  type Condition,
  type GroupBy,
  type TagFilters,
  type WorkSummary,
} from "@mimimilli/shared";
import type { EvalContext } from "../adapter/condition.ts";
import { textMatcher } from "./worksQuery.ts";

const DAY_MS = 86_400_000;

/** 基準時刻から withinDays 日前の ISO 文字列。この時刻ちょうどは範囲内 */
export function withinDaysCutoff(now: number, withinDays: number): string {
  return new Date(now - withinDays * DAY_MS).toISOString();
}

export type WorkMatcher = (work: WorkSummary) => boolean;

/** 条件の木を作品の判定関数にする。検索語の正規化・期間の境界は木の構築時に1回だけ計算する */
export function createMatcher(condition: Condition, ctx: EvalContext): WorkMatcher {
  switch (condition.type) {
    case "and": {
      const children = condition.children.map((child) => createMatcher(child, ctx));
      return (work) => children.every((child) => child(work));
    }
    case "or": {
      const children = condition.children.map((child) => createMatcher(child, ctx));
      return (work) => children.some((child) => child(work));
    }
    case "not": {
      const child = createMatcher(condition.child, ctx);
      return (work) => !child(work);
    }
    case "tag":
      return (work) => (work.tags as string[]).includes(condition.tag);
    case "hasPrefix":
      return (work) =>
        work.tags.some((tag) => {
          const parsed = parseTag(tag);
          return parsed.kind === "annotated" && parsed.prefix === condition.prefix;
        });
    case "duration":
      return (work) =>
        work.totalDurationSec !== null &&
        (condition.op === "gte"
          ? work.totalDurationSec >= condition.sec
          : work.totalDurationSec <= condition.sec);
    case "bookmarked":
      return (work) => work.bookmarked;
    case "played": {
      const cutoff =
        condition.withinDays === undefined ? null : withinDaysCutoff(ctx.now, condition.withinDays);
      return (work) =>
        work.lastPlayedAt !== null && (cutoff === null || work.lastPlayedAt >= cutoff);
    }
    case "added": {
      const cutoff = withinDaysCutoff(ctx.now, condition.withinDays);
      return (work) => work.addedAt >= cutoff;
    }
    case "addedYear":
      return (work) => work.addedAt.slice(0, 4) === condition.year;
    case "hasError":
      return (work) => work.status !== "ok";
    case "text":
      return textMatcher(condition.q);
  }
}

export function matchCondition(condition: Condition, work: WorkSummary, ctx: EvalContext): boolean {
  return createMatcher(condition, ctx)(work);
}

export interface EffectiveConditionInput {
  /** スマートフォルダーの条件 */
  condition: Condition;
  /** 選択中のグループの値 */
  group?: { by: GroupBy; value: string };
  /** チップ。擬似タグ @year/… は分解済みの yearValue で届く */
  tags?: TagFilters;
  q?: string;
}

function groupPredicate(by: GroupBy, value: string): Condition {
  switch (by.kind) {
    case "prefix":
      return { type: "tag", tag: `${by.prefix}/${value}` };
    case "tag":
      return { type: "tag", tag: value };
    case "addedYear":
      return { type: "addedYear", year: value };
  }
}

/** スマートフォルダー・グループの値・チップ・検索語から、評価に渡す1本の木を作る */
export function buildEffectiveCondition(input: EffectiveConditionInput): Condition {
  const { condition } = input;
  const children: Condition[] = condition.type === "and" ? [...condition.children] : [condition];
  if (input.group) children.push(groupPredicate(input.group.by, input.group.value));
  for (const tag of input.tags?.tags ?? []) children.push({ type: "tag", tag });
  if (input.tags?.yearValue != null)
    children.push({ type: "addedYear", year: input.tags.yearValue });
  if (input.q) children.push({ type: "text", q: input.q });
  return children.length === 0 ? EMPTY_CONDITION : { type: "and", children };
}
