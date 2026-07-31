import { toWorkListItem, type SmartFolder, type WorksPage } from "@mimimilli/shared";
import { evalSmartFolder } from "../../core/smartFolder.ts";
import type { WorkRepo } from "./workRepo.ts";

/** GET /api/smart-folders/:id/works の real 評価経路（ADR-0008）。 */
export function querySmartFolderWorks(
  repo: WorkRepo,
  folder: Pick<SmartFolder, "rules" | "sort">,
  query: { page: number; limit: number; seed?: number },
): WorksPage {
  if (folder.rules.length === 0) {
    return repo.queryWorks({
      q: "",
      tags: [],
      tagOp: "AND",
      sort: folder.sort,
      page: query.page,
      limit: query.limit,
      seed: query.seed,
    });
  }
  const candidateIds = repo.resolveSmartFolderCandidateIds(folder.rules)!;
  const works = repo.listSummaries([...candidateIds]);
  const page = evalSmartFolder(folder, works, query);
  return page.seed === undefined
    ? { items: page.items.map(toWorkListItem), total: page.total, stats: page.stats }
    : {
        items: page.items.map(toWorkListItem),
        total: page.total,
        stats: page.stats,
        seed: page.seed,
      };
}
