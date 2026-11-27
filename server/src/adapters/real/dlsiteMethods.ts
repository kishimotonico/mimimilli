import {
  hasRjCode,
  errorMessage,
  type DlsiteFetchResult,
  type DlsiteTerminalProductSummary,
  type DlsiteWorkFetchResult,
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
import type { DlsiteParser } from "./dlsite.ts";
import { createDlsiteFetch } from "./dlsiteFetch.ts";
import {
  cachedCoverOf,
  createCandidateDlsiteSource,
  deriveDlsiteProductSummary,
} from "./scanCandidateDlsite.ts";
import { createDlsiteApply } from "./dlsiteApply.ts";
import { createDlsiteProductResolver, readUsableDlsite } from "./dlsiteProductResolve.ts";
import { sniffImageContentType } from "./dlsiteCoverStaging.ts";
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
  parser: DlsiteParser;
}) {
  const { query, catalog, dlsiteCache } = deps;
  const fetch = createDlsiteFetch(deps);
  const resolveDlsiteProduct = createDlsiteProductResolver(dlsiteCache, deps.parser);
  const candidateDlsite = createCandidateDlsiteSource(dlsiteCache, resolveDlsiteProduct);
  const apply = createDlsiteApply({
    catalog,
    scanner: deps.scanner,
    dlsiteCache,
    resolve: resolveDlsiteProduct,
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
      await fetch.prefetchCover(result.info.coverUrl, {
        signal: options.signal,
        deadlineMs,
        force,
      });
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
    ): Promise<DlsiteWorkFetchResult> {
      const work = getWorkFromCatalog(query, workId);
      if (!work)
        return { ok: false, kind: "not_found", message: `作品が見つかりません: ${workId}` };
      if (!hasRjCode(work.dlsite)) {
        return { ok: false, kind: "not_found", message: "RJコードが検出されていません" };
      }
      const rjCode = work.dlsite.rjCode;
      const result = await fetchProduct(rjCode, force, {
        signal: options?.signal,
        synchronous: true,
      });
      if (!result.ok) return result;
      const usable = readUsableDlsite(resolveDlsiteProduct, rjCode);
      if (!usable) {
        return {
          ok: false,
          kind: "error",
          message: `DLsite情報を読み出せませんでした（${rjCode}）`,
        };
      }
      return {
        ok: true,
        info: usable.info,
        infoRevision: usable.revision,
        cachedCover: cachedCoverOf(usable.info.coverUrl, (key) =>
          dlsiteCache.coverVersionByKey(key),
        ),
      };
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
    ): Promise<DlsiteTerminalProductSummary> {
      fetch.dlsiteScheduler.assertOnline();
      try {
        await fetchProduct(productCode, options.force, {
          signal: options.signal,
          synchronous: false,
        });
        const summary = deriveDlsiteProductSummary(candidateDlsite, productCode);
        return summary.state === "none" ? { state: "failed" } : summary;
      } catch (error) {
        if (options.signal?.aborted) throw error;
        fetch.dlsiteLogger.error("DLsite取得に失敗しました", {
          productCode,
          message: errorMessage(error),
        });
        return { state: "failed" };
      } finally {
        if (options.signal?.aborted) await fetch.dlsiteScheduler.drain();
      }
    },

    /** 進行中のDLsite通信を中止する。キャッシュとDBを閉じる前に呼ぶ */
    abortDlsiteWork: fetch.abortInFlight,

    ...apply,
  };
}
