import {
  EMPTY_TAG_FILTERS,
  type AxisFacetItem,
  type AxisFacetsQuery,
  type SmartFolder,
  type SmartFolderRule,
  type WorksPage,
} from "@mimimilli/shared";
import { evalSmartFolder, evalSmartFolderRules } from "../../core/smartFolder.ts";
import { buildAxisFacets } from "../../core/axisFacets.ts";
import { toWorksPage } from "../../core/worksQuery.ts";
import type { SmartFolderEvalQuery } from "@mimimilli/shared";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const smartFolderLogger = getCategoryLogger("http");

export function querySmartFolderWorks(
  query: WorkQueryRepository,
  folder: Pick<SmartFolder, "rules" | "sort">,
  evalQuery: SmartFolderEvalQuery,
  root: string,
): WorksPage {
  if (folder.rules.length === 0) {
    return query.queryWorks(
      {
        q: "",
        tags: evalQuery.tags ?? EMPTY_TAG_FILTERS,
        tagOp: evalQuery.tagOp ?? "AND",
        sort: folder.sort,
        page: evalQuery.page,
        limit: evalQuery.limit,
        seed: evalQuery.seed,
      },
      root,
    );
  }
  const candidateIds = query.resolveSmartFolderCandidateIds(folder.rules)!;
  const { summaries, skipped } = query.listSummaries([...candidateIds]);
  logDataIntegritySkips(smartFolderLogger, "smart-folder-works", skipped);
  const dataIntegrityWarning = toDataIntegrityWarning(skipped);
  const page = evalSmartFolder(folder, summaries, evalQuery);
  const worksPage = toWorksPage(page, root);
  return dataIntegrityWarning ? { ...worksPage, dataIntegrityWarning } : worksPage;
}

/** 未保存のドラフトルールをチップ絞り込みなしで評価し、一致件数だけ返す（POST /smart-folders/preview） */
export function countSmartFolderRuleMatches(
  query: WorkQueryRepository,
  rules: SmartFolderRule[],
): number {
  if (rules.length === 0) {
    return query.listSummaries().summaries.length;
  }
  const candidateIds = query.resolveSmartFolderCandidateIds(rules)!;
  const { summaries, skipped } = query.listSummaries([...candidateIds]);
  logDataIntegritySkips(smartFolderLogger, "smart-folder-preview", skipped);
  return evalSmartFolderRules(rules, summaries).length;
}

/** スマートフォルダー表示中の軸ファセット集計（GET /axes/:axis?smartFolder=<id>）。
 *  フォルダー条件に一致する作品だけを対象に集計し、チップ選択タグとのANDは
 *  buildAxisFacets（作品一覧・条件プレビューと同じ core 関数）に委ねる。
 *  ルール評価そのものは resolveSmartFolderCandidateIds によるSQL候補抽出と
 *  evalSmartFolderRules による最終評価という、他の2経路と同じ2段構成を使う（ADR-0008）。 */
export function getSmartFolderAxisFacets(
  query: WorkQueryRepository,
  axis: string,
  folder: Pick<SmartFolder, "rules">,
  filter: Partial<AxisFacetsQuery>,
): AxisFacetItem[] {
  if (folder.rules.length === 0) {
    return query.getAxisFacets(axis, filter);
  }
  const candidateIds = query.resolveSmartFolderCandidateIds(folder.rules)!;
  const { summaries, skipped } = query.listSummaries([...candidateIds]);
  logDataIntegritySkips(smartFolderLogger, "smart-folder-axis-facets", skipped);
  const matched = evalSmartFolderRules(folder.rules, summaries);
  return buildAxisFacets(axis, matched, filter);
}
