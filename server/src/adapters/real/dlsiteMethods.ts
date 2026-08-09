import { basename } from "node:path";
import type { DlsiteFetchResult } from "@mimimilli/shared";
import { detectRjCode } from "./dlsite.ts";
import { DlsiteCache } from "./dlsiteCache.ts";
import type { DlsiteCacheOptions } from "./dlsiteCache.ts";
import type { DlsiteRequestConfig } from "./dlsiteConfig.ts";
import { DlsiteScheduler } from "./dlsiteScheduler.ts";
import type { DlsiteSchedulerDependencies } from "./dlsiteScheduler.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { createDlsiteFetch } from "./dlsiteFetch.ts";
import { createDlsiteApply } from "./dlsiteApply.ts";
import { createDlsiteBulk } from "./dlsiteBulk.ts";

export function createDlsiteMethods(deps: {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  dlsiteCache: DlsiteCache;
  dlsiteCacheOptions: DlsiteCacheOptions;
  dlsiteRequestConfig: DlsiteRequestConfig;
  dlsiteScheduler: DlsiteScheduler;
  schedulerDependencies?: DlsiteSchedulerDependencies;
}) {
  const { db, query, catalog } = deps;
  const fetch = createDlsiteFetch(deps);
  const apply = createDlsiteApply({ db, query, catalog, fetch });
  const bulk = createDlsiteBulk({ db, query, catalog, fetch });

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
      return fetch.fetchCachedDlsite(rjCode, force, options?.signal);
    },

    async dlsiteFetchByCode(
      rjCode: string,
      force = false,
      options?: { signal?: AbortSignal },
    ): Promise<DlsiteFetchResult> {
      return fetch.fetchCachedDlsite(rjCode, force, options?.signal);
    },

    ...apply,
    ...bulk,
  };
}
