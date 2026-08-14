import {
  applyDlsiteStatePatch,
  dedupeTags,
  type DlsiteStatePatch,
  type NormalizedTag,
  type Work,
} from "@mimimilli/shared";
import { persistDlsiteAppliedWork } from "./dlsitePersist.ts";
import { patchMetaFileCas, readMetaSource } from "./meta.ts";
import { toMetaDlsiteState } from "./dlsiteProjection.ts";
import { getWorkWithLiveProbe } from "./workRefresh.ts";
import { throwIfAborted } from "./sharedFlight.ts";
import type { Db } from "./db.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import type { WorkQueryRepository } from "./workQueryRepository.ts";
import type { Scanner } from "./scanner.ts";
import type { CoverColumns } from "./workRowMapping.ts";
import type { createDlsiteFetch } from "./dlsiteFetch.ts";

export interface DlsiteApplyDeps {
  db: Db;
  query: WorkQueryRepository;
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  fetch: ReturnType<typeof createDlsiteFetch>;
}

export function createDlsiteApply(deps: DlsiteApplyDeps) {
  const { db, query, catalog, scanner, fetch } = deps;
  const { cachedCover, measureDownloadedCover } = fetch;

  return {
    async dlsiteApply(
      workId: string,
      body: import("@mimimilli/shared").DlsiteApplyBody,
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
      if (body.applyUrl && body.info.url) {
        patch.urls = [
          ...work.urls.filter((entry) => !entry.url.includes("dlsite.com")),
          { label: "DLsite", url: body.info.url },
        ];
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

      return await persistDlsiteAppliedWork(
        catalog,
        scanner,
        {
          workId,
          sourceRevision: body.sourceRevision,
          catalogPatch: patch,
          coverImage,
          rjCode: body.info.rjCode,
          appliedTags: dedupeTags([...work.dlsite.appliedTags, ...body.applyTags]),
        },
        { ifWorkMissing: "return-false" },
      );
    },

    async updateDlsiteState(workId: string, patch: DlsiteStatePatch): Promise<Work | null> {
      const work = await getWorkWithLiveProbe(db, query, catalog, workId);
      if (!work) return null;
      const dlsite = toMetaDlsiteState(applyDlsiteStatePatch(work.dlsite, patch));
      const metaPath = catalog.getWorkMetaPath(workId);
      if (!metaPath) return null;
      const source = readMetaSource(metaPath);
      const updated = patchMetaFileCas(metaPath, source.sourceRevision, { dlsite });
      await scanner.projectMetaFile(metaPath, updated.meta);
      return getWorkWithLiveProbe(db, query, catalog, workId);
    },
  };
}
