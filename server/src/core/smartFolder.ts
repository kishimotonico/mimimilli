// スマートフォルダーのルール評価（GET /api/smart-folders/:id/works）の純粋関数。
// client/mocks/handlers/library.ts の filterSmartFolderWorks と同じセマンティクスを再現する。
// 未知の field/operator の組み合わせを持つルールは評価をスキップする（隠蔽せず無視するだけ）。
import type { SmartFolderRule, WorkSummary } from "@mimikago/shared";

/** rules を順に適用し、works をフィルタリングして返す */
export function evalSmartFolderRules(rules: SmartFolderRule[], works: WorkSummary[]): WorkSummary[] {
  let result = [...works];

  for (const rule of rules) {
    if (rule.field === "タグ" && rule.operator === "∋") {
      const values = rule.values;
      if (rule.conjunction === "AND NOT") {
        result = result.filter((w) => !values.some((v) => w.tags.includes(v)));
      } else {
        result = result.filter((w) => values.some((v) => w.tags.includes(v)));
      }
    } else if (rule.field === "長さ" && rule.operator === "≥") {
      const minSec = parseInt(rule.values[0] ?? "0", 10);
      result = result.filter((w) => w.totalDurationSec >= minSec);
    }
    // 未知の field/operator はこのルールをスキップする
  }

  return result;
}
