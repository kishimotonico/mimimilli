// 条件の木をアダプタへ渡す入力の型（ADR-0040）。
import type { Condition, GroupBy, SortId } from "@mimimilli/shared";

/** 評価コンテキスト。now は route が1リクエストにつき1回作る（エポックミリ秒） */
export interface EvalContext {
  now: number;
}

export interface ConditionWorksQuery {
  condition: Condition;
  /** スキャン記録の絞り込み。保存されない一時的な集合 */
  ids?: string[];
  sort: SortId;
  /** sort=random のとき必須。サーバーは発行しない */
  seed?: number;
  page: number;
  limit: number;
}

export interface ConditionGroupQuery {
  condition: Condition;
  groupBy: GroupBy;
}
