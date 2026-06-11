// スマートフォルダーのルール評価（GET /api/smart-folders/:id/works）の純粋関数。
// client/mocks/handlers/library.ts の filterSmartFolderWorks と同じセマンティクスを再現する。
// shared スキーマが許可した field/operator のみを評価する。DB 内の不正値も黙って無視しない。
import type { SmartFolder, SmartFolderRule, WorkSummary } from "@mimikago/shared";
import { sortWorkSummaries } from "./worksQuery.ts";

/** rules を順に適用し、works をフィルタリングして返す */
export function evalSmartFolderRules(rules: SmartFolderRule[], works: WorkSummary[]): WorkSummary[] {
  let result = [...works];

  for (const rule of rules) {
    switch (rule.field) {
      case "タグ": {
        const values = rule.values;
        if (rule.conjunction === "AND NOT") {
          result = result.filter((w) => !values.some((v) => w.tags.includes(v)));
        } else {
          result = result.filter((w) => values.some((v) => w.tags.includes(v)));
        }
        break;
      }
      case "長さ": {
        const minSec = Number(rule.values[0]);
        if (!Number.isFinite(minSec)) {
          throw new Error(`スマートフォルダーの長さ条件が不正です: ${rule.values[0]}`);
        }
        result = result.filter((w) => w.totalDurationSec >= minSec);
        break;
      }
      default:
        throw new Error(`未対応のスマートフォルダールールです: ${JSON.stringify(rule)}`);
    }
  }

  return result;
}

/** 保存済みルールと sort を一体で評価する。 */
export function evalSmartFolder(folder: Pick<SmartFolder, "rules" | "sort">, works: WorkSummary[]): WorkSummary[] {
  return sortWorkSummaries(evalSmartFolderRules(folder.rules, works), folder.sort);
}
