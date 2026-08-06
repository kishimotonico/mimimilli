import {
  EMPTY_TAG_FILTERS,
  toWorkListItem,
  type SmartFolder,
  type WorksPage,
} from "@mimimilli/shared";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import type { SmartFolderEvalQuery } from "../../adapter.ts";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips, toDataIntegrityWarning } from "./dataIntegrity.ts";
import type { WorkRepo } from "./workRepo.ts";

const smartFolderLogger = getCategoryLogger("http");

/** GET /api/smart-folders/:id/works の real 評価経路（ADR-0008）。
 *  tags はフォルダーのルールに対する追加の AND 条件として適用する（TASK-185）。 */
export function querySmartFolderWorks(
  repo: WorkRepo,
  folder: Pick<SmartFolder, "rules" | "sort">,
  query: SmartFolderEvalQuery,
): WorksPage {
  if (folder.rules.length === 0) {
    return repo.queryWorks({
      q: "",
      tags: query.tags ?? EMPTY_TAG_FILTERS,
      tagOp: query.tagOp ?? "AND",
      sort: folder.sort,
      page: query.page,
      limit: query.limit,
      seed: query.seed,
    });
  }
  const candidateIds = repo.resolveSmartFolderCandidateIds(folder.rules)!;
  const { summaries, skipped } = repo.listSummaries([...candidateIds]);
  logDataIntegritySkips(smartFolderLogger, "smart-folder-works", skipped);
  const dataIntegrityWarning = toDataIntegrityWarning(skipped);
  const page = evalSmartFolder(folder, summaries, query);
  const envelope =
    page.seed === undefined
      ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
      : {
          items: page.items.map(toWorkListItem),
          total: page.total,
          stats: page.stats,
          seed: page.seed,
        };
  return dataIntegrityWarning ? { ...envelope, dataIntegrityWarning } : envelope;
}
