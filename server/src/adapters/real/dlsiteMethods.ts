import { basename } from "node:path";
import {
  computeMissingDiff,
  detectRjCode,
  hasRjCode,
  dlsiteProductFetchOutcomeOfResult,
  errorMessage,
  type DlsiteApplyMissingPreviewItem,
  type DlsiteFetchResult,
  type DlsiteProductFetchOutcome,
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
import { getWorkFromCatalog } from "./workRefresh.ts";
import { createDlsiteFetch } from "./dlsiteFetch.ts";
import { cachedCoverOf } from "./scanCandidateDlsite.ts";
import { createDlsiteApply } from "./dlsiteApply.ts";
import { sniffImageContentType } from "./dlsiteCoverStaging.ts";
import { MetaParseError } from "./meta.ts";
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
  requireRoot: () => string;
}) {
  const { query, catalog, dlsiteCache } = deps;
  const fetch = createDlsiteFetch(deps);
  const apply = createDlsiteApply({
    catalog,
    scanner: deps.scanner,
    dlsiteCache,
    requireRoot: deps.requireRoot,
  });
  const fetchTimeoutMs = deps.dlsiteRequestConfig.timeoutMs;

  /** 取得の本体。HTML取得、カバー先取り、同じRJコードを持つ全作品の投影更新を行う。
   *  同期経路ではHTMLと合わせて総期限に収まる範囲でカバーを取る */
  async function fetchProduct(
    productCode: string,
    force: boolean,
    options: { signal?: AbortSignal; synchronous: boolean },
  ): Promise<DlsiteFetchResult> {
    const deadlineMs = options.synchronous ? Date.now() + fetchTimeoutMs : undefined;
    const result = await fetch.fetchCachedDlsite(productCode, force, options.signal);
    if (result.ok) {
      await fetch.prefetchCover(result.info.coverUrl, { signal: options.signal, deadlineMs });
    }
    if (shouldRefreshDlsiteProjectionAfterFetch(result)) {
      for (const workId of query.listWorkIdsByRjCode(productCode)) {
        try {
          refreshWorkDlsiteProjection(catalog, workId, dlsiteCache);
        } catch (error) {
          fetch.dlsiteLogger.warn("DLsite取得後の作品の投影更新に失敗しました", {
            workId,
            productCode,
            message: errorMessage(error),
          });
        }
      }
    }
    return result;
  }

  return {
    lookupDlsiteCachedCover(coverUrl: string | null) {
      return cachedCoverOf(coverUrl, (key) => dlsiteCache.coverVersionByKey(key));
    },

    getCachedDlsiteCover(coverKey: string) {
      const cover = dlsiteCache.getCoverByKey(coverKey);
      if (!cover) return null;
      const contentType = sniffImageContentType(cover.body);
      if (!contentType) {
        fetch.dlsiteLogger.warn("DLsiteカバーの画像形式を判定できませんでした", { coverKey });
        return null;
      }
      return { body: cover.body, contentType, version: cover.fetchedAt };
    },

    isDlsiteOffline(): boolean {
      return deps.dlsiteRequestConfig.offline;
    },

    async dlsiteFetch(
      workId: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      const work = getWorkFromCatalog(query, workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      const rjCode = work.dlsite.rjCode ?? detectRjCode([basename(work.physicalPath), work.title]);
      if (!rjCode) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      return fetchProduct(rjCode, force, { signal: options?.signal, synchronous: true });
    },

    async dlsiteFetchByCode(
      rjCode: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      return fetchProduct(rjCode, force, { signal: options?.signal, synchronous: true });
    },

    async fetchDlsiteProduct(
      productCode: string,
      options: { force: boolean; signal?: AbortSignal },
    ): Promise<DlsiteProductFetchOutcome> {
      fetch.dlsiteScheduler.assertOnline();
      try {
        const result = await fetchProduct(productCode, options.force, {
          signal: options.signal,
          synchronous: false,
        });
        return dlsiteProductFetchOutcomeOfResult(result);
      } catch (error) {
        if (options.signal?.aborted) throw error;
        fetch.dlsiteLogger.error("DLsite取得に失敗しました", {
          productCode,
          message: errorMessage(error),
        });
        return "failed";
      } finally {
        if (options.signal?.aborted) await fetch.dlsiteScheduler.drain();
      }
    },

    async dlsiteApplyMissing(workIds?: string[]) {
      const { summaries } = query.listSummaries(workIds);
      const result = { applied: 0, pending: 0, skipped: 0, failed: 0 };
      for (const summary of summaries) {
        if (!hasRjCode(summary.dlsite) || summary.dlsite.status === "skipped") {
          result.skipped += 1;
          continue;
        }
        try {
          const fetched = await fetch.fetchCachedDlsite(summary.dlsite.rjCode);
          if (shouldRefreshDlsiteProjectionAfterFetch(fetched)) {
            refreshWorkDlsiteProjection(catalog, summary.id, dlsiteCache);
          }
          if (!fetched.ok) {
            result.failed += 1;
            continue;
          }
          const outcome = await apply.applyDlsiteMissingItem(summary.id, fetched.info);
          if (outcome === "applied") result.applied += 1;
          else if (outcome === "pending") result.pending += 1;
          else result.skipped += 1;
        } catch {
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
        let fetched: DlsiteFetchResult | undefined;
        let verified;
        try {
          fetched = await fetch.fetchCachedDlsite(summary.dlsite.rjCode);
          if (shouldRefreshDlsiteProjectionAfterFetch(fetched)) {
            refreshWorkDlsiteProjection(catalog, summary.id, dlsiteCache);
          }
          if (!fetched.ok) continue;
          verified = readVerifiedEditSource(catalog, summary.id);
        } catch (error) {
          if (
            error instanceof SourceParseError ||
            error instanceof SourceConflictError ||
            error instanceof MetaParseError
          ) {
            continue;
          }
          throw error;
        }
        if (!fetched?.ok || !verified) continue;
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
  };
}
