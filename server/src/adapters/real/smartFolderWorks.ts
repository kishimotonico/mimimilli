import { EMPTY_TAG_FILTERS, type SmartFolder, type WorksPage } from "@mimimilli/shared";
import { evalSmartFolder } from "../../core/smartFolder.ts";
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
): WorksPage {
  if (folder.rules.length === 0) {
    return query.queryWorks({
      q: "",
      tags: evalQuery.tags ?? EMPTY_TAG_FILTERS,
      tagOp: evalQuery.tagOp ?? "AND",
      sort: folder.sort,
      page: evalQuery.page,
      limit: evalQuery.limit,
      seed: evalQuery.seed,
    });
  }
  const candidateIds = query.resolveSmartFolderCandidateIds(folder.rules)!;
  const { summaries, skipped } = query.listSummaries([...candidateIds]);
  logDataIntegritySkips(smartFolderLogger, "smart-folder-works", skipped);
  const dataIntegrityWarning = toDataIntegrityWarning(skipped);
  const page = evalSmartFolder(folder, summaries, evalQuery);
  const worksPage = toWorksPage(page);
  return dataIntegrityWarning ? { ...worksPage, dataIntegrityWarning } : worksPage;
}
