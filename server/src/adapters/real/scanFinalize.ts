import { join } from "node:path";
import { getCategoryLogger } from "../../lib/logger.ts";
import { logDataIntegritySkips } from "./dataIntegrity.ts";
import { resolveWithin } from "./paths.ts";
import { gcThumbnailCache, type WorkCoverEntry } from "./thumbnailCache.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";

const scanLogger = getCategoryLogger("scan");

export const LAST_SCAN_TIME_KEY = "last_scan_time";

export async function finalizeScan(deps: {
  query: Pick<WorkQueryRepository, "listSummaries">;
  catalog: Pick<CatalogWorkRepository, "setScanState">;
  thumbnailCacheDir: string;
  throwIfCancelled?: () => void;
  integrityLogContext?: string;
}): Promise<void> {
  const {
    query,
    catalog,
    thumbnailCacheDir,
    throwIfCancelled,
    integrityLogContext = "scan-finalize",
  } = deps;
  const checkAbort = () => throwIfCancelled?.();

  checkAbort();
  const coverEntries: WorkCoverEntry[] = [];
  const { summaries, skipped } = query.listSummaries();
  logDataIntegritySkips(scanLogger, integrityLogContext, skipped);
  let unresolvedCoverCount = 0;
  for (const work of summaries) {
    checkAbort();
    if (!work.cover) continue;
    const resolved = resolveWithin(work.physicalPath, join(work.physicalPath, work.cover.image));
    if (!resolved) {
      unresolvedCoverCount++;
      continue;
    }
    coverEntries.push({ workId: work.id, coverAbsolutePath: resolved });
  }
  checkAbort();
  const skipGc = summaries.length === 0 || skipped.length > 0 || unresolvedCoverCount > 0;
  if (skipGc) {
    const reason =
      summaries.length === 0
        ? "no-works"
        : skipped.length > 0
          ? "skipped-works"
          : "unresolved-covers";
    scanLogger.warn("スナップショットが不完全なためサムネイルキャッシュGCをスキップしました", {
      reason,
      workCount: summaries.length,
      skippedCount: skipped.length,
      unresolvedCoverCount,
      cacheDir: thumbnailCacheDir,
    });
  } else {
    const gcResult = await gcThumbnailCache(thumbnailCacheDir, coverEntries, {
      throwIfCancelled: checkAbort,
    });
    checkAbort();
    if (gcResult.deletionSkipped) {
      scanLogger.warn("スナップショットが不完全なためサムネイルキャッシュGCをスキップしました", {
        reason: "cover-stat-failed",
        workCount: summaries.length,
        skippedCount: gcResult.skippedWorks,
        unresolvedCoverCount: 0,
        cacheDir: thumbnailCacheDir,
      });
    } else if (gcResult.deleted > 0 || gcResult.skippedWorks > 0) {
      scanLogger.warn("サムネイルキャッシュGCを実行しました", {
        deleted: gcResult.deleted,
        kept: gcResult.kept,
        skippedWorks: gcResult.skippedWorks,
      });
    }
  }
  checkAbort();
  catalog.setScanState(LAST_SCAN_TIME_KEY, new Date().toISOString());
}
