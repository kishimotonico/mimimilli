// スマートフォルダーのルール評価（GET /api/smart-folders/:id/works）の純粋関数。
// shared スキーマが許可した field/operator のみを評価する。DB 内の不正値も黙って無視しない。
import type { SmartFolder, SmartFolderRule, TagFilters, WorkSummary } from "@mimimilli/shared";
import { EMPTY_TAG_FILTERS, createRandomSeed } from "@mimimilli/shared";
import type { WorkSummaryPage } from "./worksQuery.ts";
import { tagEquals } from "@mimimilli/shared";
import {
  computeCollectionStats,
  filterByTags,
  filterByYear,
  sortWorkSummaries,
} from "./worksQuery.ts";

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
          works
            .filter((w) => values.some((v) => w.tags.some((tag) => tagEquals(tag, v))))
            .map((w) => w.id),
        );
        break;
      }
      case "長さ": {
        const minSec = Number(rule.values[0]);
        if (!Number.isFinite(minSec)) {
          throw new Error(`スマートフォルダーの長さ条件が不正です: ${rule.values[0]}`);
        }
        // totalDurationSec が未知（null）の作品は「長さ条件を満たす」側に丸めず除外する。
        matchingIds = new Set(
          works
            .filter((w) => w.totalDurationSec !== null && w.totalDurationSec >= minSec)
            .map((w) => w.id),
        );
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

/** 保存済みルールと sort を一体で評価し、ページングエンベロープを返す。
 *  tags はルールに対する追加の AND 条件として適用する（ADR-0012、TASK-185）。組み込み軸の
 *  year 値も TagFilters 経由で渡る（TASK-199）。
 *  total はソート後・ページング前の評価結果件数。random ソート時は seed を発行・継承する。 */
export function evalSmartFolder(
  folder: Pick<SmartFolder, "rules" | "sort">,
  works: WorkSummary[],
  query: {
    page: number;
    limit: number;
    seed?: number;
    tags?: TagFilters;
    tagOp?: "AND" | "OR";
  },
): WorkSummaryPage {
  const seed = folder.sort === "random" ? (query.seed ?? createRandomSeed()) : undefined;
  const { tags, yearValue } = query.tags ?? EMPTY_TAG_FILTERS;
  let matched = evalSmartFolderRules(folder.rules, works);
  matched = filterByTags(matched, tags, query.tagOp ?? "AND");
  matched = filterByYear(matched, yearValue);
  matched = sortWorkSummaries(matched, folder.sort, seed);

  const total = matched.length;
  const stats = computeCollectionStats(matched);
  const start = (query.page - 1) * query.limit;
  const items = matched.slice(start, start + query.limit);

  return seed === undefined ? { items, total, stats } : { items, total, stats, seed };
}
