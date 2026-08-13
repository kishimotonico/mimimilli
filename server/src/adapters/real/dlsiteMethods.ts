import { basename } from "node:path";
import { hasRjCode, type DlsiteFetchResult } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { DlsiteCache } from "./dlsiteCache.ts";
import type { DlsiteCacheOptions } from "./dlsiteCache.ts";
import type { DlsiteRequestConfig } from "./dlsiteConfig.ts";
import { DlsiteScheduler } from "./dlsiteScheduler.ts";
import type { DlsiteSchedulerDependencies } from "./dlsiteScheduler.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { createDlsiteFetch } from "./dlsiteFetch.ts";
import { createDlsiteApply } from "./dlsiteApply.ts";
import { createDlsiteBulk } from "./dlsiteBulk.ts";
import { mergeDlsiteTags } from "./dlsite.ts";
import { readMetaSource } from "./meta.ts";
import {
  refreshWorkDlsiteProjection,
  shouldRefreshDlsiteProjectionAfterFetch,
} from "./dlsiteProjection.ts";

export function createDlsiteMethods(deps: {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  dlsiteCache: DlsiteCache;
  dlsiteCacheOptions: DlsiteCacheOptions;
  dlsiteRequestConfig: DlsiteRequestConfig;
  dlsiteScheduler: DlsiteScheduler;
  schedulerDependencies?: DlsiteSchedulerDependencies;
}) {
  const { db, query, catalog, dlsiteCache } = deps;
  const fetch = createDlsiteFetch(deps);
  const apply = createDlsiteApply({ db, query, catalog, scanner: deps.scanner, fetch });
  const bulk = createDlsiteBulk({
    db,
    query,
    catalog,
    scanner: deps.scanner,
    fetch,
    dlsiteCache: deps.dlsiteCache,
  });

  return {
    cachedCover: fetch.cachedCover,
    async dlsiteFetch(
      workId: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      const result = await fetch.fetchCachedDlsite(rjCode, force, options?.signal);
      if (shouldRefreshDlsiteProjectionAfterFetch(result)) {
        refreshWorkDlsiteProjection(catalog, workId, dlsiteCache);
      }
      return result;
    },

    async dlsiteFetchByCode(
      rjCode: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      return fetch.fetchCachedDlsite(rjCode, force, options?.signal);
    },

    async dlsiteApplyMissing(workIds?: string[]) {
      const { summaries } = query.listSummaries(workIds);
      const result = { applied: 0, skipped: 0, failed: 0 };
      for (const summary of summaries) {
        if (!hasRjCode(summary.dlsite) || summary.dlsite.status === "skipped") {
          result.skipped += 1;
          continue;
        }
        const fetched = await fetch.fetchCachedDlsite(summary.dlsite.rjCode!);
        if (shouldRefreshDlsiteProjectionAfterFetch(fetched)) {
          refreshWorkDlsiteProjection(catalog, summary.id, dlsiteCache);
        }
        if (!fetched.ok) {
          result.failed += 1;
          continue;
        }
        const work = await getWorkWithLiveProbe(db, query, catalog, summary.id);
        const metaPath = catalog.getWorkMetaPath(summary.id);
        if (!work || !metaPath) {
          result.skipped += 1;
          continue;
        }
        const tags = mergeDlsiteTags([], fetched.info).filter((tag) => !work.tags.includes(tag));
        const applyCover = !work.cover && fetched.info.coverUrl !== null;
        const applyUrl = !work.urls.some((entry) => entry.url.includes("dlsite.com"));
        if (tags.length === 0 && !applyCover && !applyUrl) {
          result.skipped += 1;
          continue;
        }
        try {
          const applied = await apply.dlsiteApply(summary.id, {
            info: fetched.info,
            sourceRevision: readMetaSource(metaPath).sourceRevision,
            applyTitle: false,
            applyTags: tags,
            applyCover,
            applyUrl,
          });
          if (applied) result.applied += 1;
          else result.skipped += 1;
        } catch {
          result.failed += 1;
        }
      }
      return result;
    },

    ...apply,
    ...bulk,
  };
}
