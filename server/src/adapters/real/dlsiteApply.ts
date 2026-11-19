import {
  applyDlsiteStatePatch,
  buildDlsiteApplyPatch,
  workPlacementOf,
  type DlsiteApplyBody,
  type DlsiteStateUpdateBody,
  type MetaDlsiteState,
  type NormalizedTag,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import { MetaMutationReject, encodeMetaRaw } from "./meta.ts";
import { CoverSaveError, SourceChangedError } from "../../errors.ts";
import { throwIfAborted } from "./sharedFlight.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import {
  mutateVerifiedMetaSource,
  projectVerifiedSource,
  readVerifiedEditSource,
} from "./workEditSource.ts";
import type { Scanner } from "./scanner.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { stageCachedDlsiteCover } from "./dlsiteCoverStaging.ts";

export interface DlsiteApplyDeps {
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  dlsiteCache: DlsiteCache;
  requireRoot: () => string;
}

function applyDlsiteMergeToRaw(
  sourceBytes: Buffer,
  input: {
    title?: string;
    tags?: NormalizedTag[];
    urls?: { label: string; url: string }[];
    coverImage?: string;
    dlsite: MetaDlsiteState;
  },
): Buffer {
  const raw = JSON.parse(sourceBytes.toString("utf-8")) as Record<string, unknown>;
  if (input.title !== undefined) raw.title = input.title;
  if (input.tags !== undefined) raw.tags = input.tags;
  if (input.urls !== undefined) raw.urls = input.urls;
  if (input.coverImage !== undefined) raw.coverImage = input.coverImage;
  raw.dlsite = input.dlsite;
  return encodeMetaRaw(raw);
}

export function createDlsiteApply(deps: DlsiteApplyDeps) {
  const { catalog, scanner, dlsiteCache, requireRoot } = deps;

  async function persistVerified(
    verified: ReturnType<typeof mutateVerifiedMetaSource>,
  ): Promise<WorkSourceMutationResult | null> {
    if (!verified) return null;
    return projectVerifiedSource(scanner, verified);
  }

  return {
    async dlsiteApply(
      workId: string,
      body: DlsiteApplyBody,
      options?: { signal?: AbortSignal },
    ): Promise<WorkSourceMutationResult | null> {
      const signal = options?.signal;
      throwIfAborted(signal, "DLsite取得は中止されました");
      const current = readVerifiedEditSource(catalog, workId);
      if (!current) return null;

      const coverUrl = body.applyCover ? body.info.coverUrl : null;
      const cover = coverUrl
        ? await stageCachedDlsiteCover(
            dlsiteCache,
            coverUrl,
            workPlacementOf(current.metaPath).mediaRoot,
            requireRoot(),
          )
        : null;
      if (coverUrl && !cover) throw new CoverSaveError();

      try {
        throwIfAborted(signal, "DLsite取得は中止されました");
        return await persistVerified(
          mutateVerifiedMetaSource(catalog, workId, (source) => {
            if (source.sourceRevision !== body.sourceRevision) {
              return new MetaMutationReject(new SourceChangedError());
            }
            const patch = buildDlsiteApplyPatch(
              {
                title: source.meta.title,
                tags: source.meta.tags,
                urls: source.meta.urls,
                dlsite: source.meta.dlsite,
              },
              body,
            );
            cover?.commit();
            return applyDlsiteMergeToRaw(source.bytes, { ...patch, coverImage: cover?.fileName });
          }),
        );
      } finally {
        cover?.discard();
      }
    },

    async updateDlsiteState(
      workId: string,
      body: DlsiteStateUpdateBody,
    ): Promise<WorkSourceMutationResult | null> {
      const { sourceRevision, ...patch } = body;
      return persistVerified(
        mutateVerifiedMetaSource(catalog, workId, (source) => {
          if (source.sourceRevision !== sourceRevision) {
            return new MetaMutationReject(new SourceChangedError());
          }
          const dlsite = applyDlsiteStatePatch(source.meta.dlsite, patch);
          const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
          raw.dlsite = dlsite;
          return encodeMetaRaw(raw);
        }),
      );
    },
  };
}
