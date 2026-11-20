import {
  applyDlsiteStatePatch,
  hasRjCode,
  planDlsiteApply,
  workPlacementOf,
  type DlsiteApplyBody,
  type DlsiteApplyResponse,
  type DlsiteStateUpdateBody,
  type MetaDlsiteState,
  type NormalizedTag,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import { MetaMutationReject, encodeMetaRaw } from "./meta.ts";
import { DlsiteRefetchRequiredError, SourceChangedError } from "../../errors.ts";
import type { CatalogWorkRepository } from "./catalogWorkRepository.ts";
import {
  mutateVerifiedMetaSource,
  projectVerifiedSource,
  readVerifiedEditSource,
} from "./workEditSource.ts";
import type { Scanner } from "./scanner.ts";
import type { DlsiteCache } from "./dlsiteCache.ts";
import { saveWithDlsiteCover } from "./dlsiteCoverStaging.ts";
import { readUsableDlsite, type DlsiteProductResolver } from "./dlsiteProductResolve.ts";

export interface DlsiteApplyDeps {
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  dlsiteCache: DlsiteCache;
  resolve: DlsiteProductResolver;
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
  const { catalog, scanner, dlsiteCache, resolve, requireRoot } = deps;

  async function persistVerified(
    verified: ReturnType<typeof mutateVerifiedMetaSource>,
  ): Promise<WorkSourceMutationResult | null> {
    if (!verified) return null;
    return projectVerifiedSource(scanner, verified);
  }

  return {
    async dlsiteApply(workId: string, body: DlsiteApplyBody): Promise<DlsiteApplyResponse | null> {
      const current = readVerifiedEditSource(catalog, workId);
      if (!current) return null;

      if (current.source.sourceRevision !== body.sourceRevision) throw new SourceChangedError();
      const linkage = current.source.meta.dlsite;
      const usable = hasRjCode(linkage) ? readUsableDlsite(resolve, linkage.rjCode) : null;
      if (!usable || usable.revision !== body.infoRevision) throw new DlsiteRefetchRequiredError();
      const { info } = usable;

      const { value: verified, coverSkipped } = await saveWithDlsiteCover(
        {
          cache: dlsiteCache,
          coverUrl: body.apply.cover ? info.coverUrl : null,
          previousCoverImage: current.source.meta.coverImage,
        },
        workPlacementOf(current.metaPath),
        requireRoot(),
        (cover) =>
          mutateVerifiedMetaSource(catalog, workId, (source) => {
            if (source.sourceRevision !== body.sourceRevision) {
              return new MetaMutationReject(new SourceChangedError());
            }
            const plan = planDlsiteApply(
              {
                title: source.meta.title,
                tags: source.meta.tags,
                urls: source.meta.urls,
                hasCover: Boolean(source.meta.coverImage),
                dlsite: source.meta.dlsite,
              },
              info,
              body.apply,
              { coverCached: cover !== null },
            );
            if (plan.applyCover) cover?.place();
            return applyDlsiteMergeToRaw(source.bytes, {
              ...plan,
              coverImage: plan.applyCover ? cover?.fileName : undefined,
            });
          }),
      );
      const result = await persistVerified(verified);
      return result && { ...result, coverSkipped };
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
