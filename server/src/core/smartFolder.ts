// スマートフォルダーのルール評価（GET /api/smart-folders/:id/works）の純粋関数。
// client/mocks/handlers/library.ts の filterSmartFolderWorks と同じセマンティクスを再現する。
// shared スキーマが許可した field/operator のみを評価する。DB 内の不正値も黙って無視しない。
import type { SmartFolder, SmartFolderRule, WorkSummary } from "@mimimilli/shared";
import { sortWorkSummaries } from "./worksQuery.ts";

/** rules を順に適用し、works をフィルタリングして返す */
export function evalSmartFolderRules(
  rules: SmartFolderRule[],
  works: WorkSummary[],
): WorkSummary[] {
  if (rules.length === 0) return [...works];

  let resultIds = new Set<string>();

  for (const [index, rule] of rules.entries()) {
    let matchingIds: Set<string>;
    switch (rule.field) {
      case "タグ": {
        const values = rule.values;
        matchingIds = new Set(
          works.filter((w) => values.some((v) => w.tags.includes(v))).map((w) => w.id),
        );
        break;
      }
      case "長さ": {
        const minSec = Number(rule.values[0]);
        if (!Number.isFinite(minSec)) {
          throw new Error(`スマートフォルダーの長さ条件が不正です: ${rule.values[0]}`);
        }
        matchingIds = new Set(works.filter((w) => w.totalDurationSec >= minSec).map((w) => w.id));
        break;
      }
      default:
        throw new Error(`未対応のスマートフォルダールールです: ${JSON.stringify(rule)}`);
    }

    if (index === 0 || rule.conjunction === "WHERE") {
      resultIds = matchingIds;
    } else if (rule.conjunction === "AND") {
      resultIds = new Set([...resultIds].filter((id) => matchingIds.has(id)));
    } else if (rule.conjunction === "OR") {
      resultIds = new Set([...resultIds, ...matchingIds]);
    } else if (rule.conjunction === "AND NOT") {
      resultIds = new Set([...resultIds].filter((id) => !matchingIds.has(id)));
    }
  }

  return works.filter((work) => resultIds.has(work.id));
}

/** 保存済みルールと sort を一体で評価する。 */
export function evalSmartFolder(
  folder: Pick<SmartFolder, "rules" | "sort">,
  works: WorkSummary[],
): WorkSummary[] {
  return sortWorkSummaries(evalSmartFolderRules(folder.rules, works), folder.sort);
}
