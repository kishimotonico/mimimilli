import { basename } from "node:path";
import {
  computeMissingDiff,
  detectRjCode,
  hasRjCode,
  type DlsiteApplyMissingPreviewItem,
  type DlsiteFetchResult,
} from "@mimimilli/shared";
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
import { readVerifiedEditSource } from "./workEditSource.ts";
import { SourceConflictError, SourceParseError } from "../../errors.ts";
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
  const apply = createDlsiteApply({ catalog, scanner: deps.scanner, fetch });
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
        const fetched = await fetch.fetchCachedDlsite(summary.dlsite.rjCode);
        if (shouldRefreshDlsiteProjectionAfterFetch(fetched)) {
          refreshWorkDlsiteProjection(catalog, summary.id, dlsiteCache);
        }
        if (!fetched.ok) {
          result.failed += 1;
          continue;
        }
        try {
          const outcome = await apply.applyDlsiteMissingItem(summary.id, fetched.info);
          if (outcome === "applied") result.applied += 1;
          else result.skipped += 1;
        } catch (error) {
          if (error instanceof SourceParseError || error instanceof SourceConflictError) {
            result.failed += 1;
            continue;
          }
          result.failed += 1;
        }
      }
      return result;
    },

    async dlsiteApplyMissingPreview(workIds?: string[]) {
      const { summaries } = query.listSummaries(workIds);
      const items: DlsiteApplyMissingPreviewItem[] = [];
      for (const summary of summaries) {
        if (!hasRjCode(summary.dlsite) || summary.dlsite.status === "skipped") continue;
        const fetched = await fetch.fetchCachedDlsite(summary.dlsite.rjCode);
        if (shouldRefreshDlsiteProjectionAfterFetch(fetched)) {
          refreshWorkDlsiteProjection(catalog, summary.id, dlsiteCache);
        }
        if (!fetched.ok) continue;
        let verified;
        try {
          verified = readVerifiedEditSource(catalog, summary.id);
        } catch (error) {
          if (error instanceof SourceParseError || error instanceof SourceConflictError) continue;
          throw error;
        }
        if (!verified) continue;
        const { newTags, applyCover, applyUrl } = computeMissingDiff(
          {
            tags: verified.source.meta.tags,
            urls: verified.source.meta.urls,
            cover: verified.source.meta.coverImage
              ? {
                  image: verified.source.meta.coverImage,
                  dimensions: { width: 1, height: 1 },
                  version: "source",
                }
              : null,
          },
          fetched.info,
        );
        if (newTags.length === 0 && !applyCover && !applyUrl) continue;
        items.push({
          workId: summary.id,
          title: verified.source.meta.title,
          newTags,
          applyCover,
          applyUrl,
        });
      }
      return { items };
    },

    ...apply,
    ...bulk,
  };
}
