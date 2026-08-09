import {
  applyDlsiteStatePatch,
  dedupeTags,
  type DlsiteApplyBody,
  type DlsiteStatePatch,
  type NormalizedTag,
  type Work,
} from "@mimimilli/shared";
import { patchMetaFile } from "./meta.ts";
import { persistDlsiteAppliedWork } from "./dlsitePersist.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { throwIfAborted } from "./sharedFlight.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import type { createDlsiteFetch } from "./dlsiteFetch.ts";

export interface DlsiteApplyDeps {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  fetch: ReturnType<typeof createDlsiteFetch>;
}

export function createDlsiteApply(deps: DlsiteApplyDeps) {
  const { db, query, catalog, fetch } = deps;
  const { cachedCover, measureDownloadedCover } = fetch;

  return {
    async dlsiteApply(
      workId: string,
      body: DlsiteApplyBody,
      options?: { signal?: AbortSignal },
    ): Promise<boolean> {
      const signal = options?.signal;
      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work) return false;

      const patch: {
        title?: string;
        tags?: NormalizedTag[];
        cover?: CoverColumns;
        urls?: Work["urls"];
      } = {};
      if (body.applyTitle && body.info.title) patch.title = body.info.title;
      const { applyTags } = body;
      if (applyTags.length > 0) patch.tags = dedupeTags([...work.tags, ...applyTags]);
      if (body.info.url && !work.urls.some((entry) => entry.url.includes("dlsite.com"))) {
        patch.urls = [...work.urls, { label: "DLsite", url: body.info.url }];
      }
      let coverImage: string | undefined;
      if (body.applyCover && body.info.coverUrl) {
        coverImage = await cachedCover(body.info.coverUrl, work.physicalPath, signal);
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
        const cover = await measureDownloadedCover(work.physicalPath, coverImage);
        if (!cover) return false;
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
        patch.cover = cover;
      }

      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");

      const dlsite = {
        rjCode: body.info.rjCode,
        status: "applied" as const,
        lastAttemptAt: new Date().toISOString(),
        error: null,
        errorKind: null,
        appliedTags: dedupeTags([...work.dlsite.appliedTags, ...applyTags]),
      };
      return persistDlsiteAppliedWork(
        db,
        catalog,
        { workId, catalogPatch: patch, coverImage, dlsite },
        { ifWorkMissing: "return-false" },
      );
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work) return null;
      const dlsite = applyDlsiteStatePatch(work.dlsite, patch);
      db.transaction(() => {
        catalog.setDlsiteState(workId, dlsite);
        const metaPath = catalog.getWorkMetaPath(workId);
        if (!metaPath) throw new Error(`作品のメタパスが見つかりません: ${workId}`);
        patchMetaFile(metaPath, { dlsite });
      });
      return getWorkWithLiveProbe(db, query, catalog, workId);
    },
  };
}
