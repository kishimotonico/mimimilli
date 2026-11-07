import {
  applyDlsiteStatePatch,
  buildDlsiteApplyPatch,
  buildDlsiteMissingApplyPatch,
  computeMissingDiff,
  workPlacementOf,
  type DlsiteApplyBody,
  type DlsiteStateUpdateBody,
  type DlsiteWorkInfo,
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
import type { createDlsiteFetch } from "./dlsiteFetch.ts";

export interface DlsiteApplyDeps {
  catalog: CatalogWorkRepository;
  scanner: Scanner;
  fetch: ReturnType<typeof createDlsiteFetch>;
  requireRoot: () => string;
}

function coverStub(coverImage: string | null) {
  return coverImage
    ? { image: coverImage, dimensions: { width: 1, height: 1 }, version: "source" }
    : null;
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
  const { catalog, scanner, fetch, requireRoot } = deps;
  const { stageCover } = fetch;

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
      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      const current = readVerifiedEditSource(catalog, workId);
      if (!current) return null;

      const coverUrl = body.applyCover ? body.info.coverUrl : null;
      const cover = coverUrl
        ? await stageCover(
            coverUrl,
            workPlacementOf(current.metaPath).mediaRoot,
            requireRoot(),
            signal,
          )
        : null;
      if (coverUrl && !cover) throw new CoverSaveError();

      try {
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
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

    async applyDlsiteMissingItem(
      workId: string,
      info: DlsiteWorkInfo,
    ): Promise<"applied" | "skipped" | "missing" | "pending"> {
      const current = readVerifiedEditSource(catalog, workId);
      if (!current) return "missing";
      const planned = computeMissingDiff(
        {
          tags: current.source.meta.tags,
          urls: current.source.meta.urls,
          cover: coverStub(current.source.meta.coverImage ?? null),
        },
        info,
      );
      if (planned.newTags.length === 0 && !planned.applyCover && !planned.applyUrl) {
        return "skipped";
      }

      const coverUrl = planned.applyCover ? info.coverUrl : null;
      const cover = coverUrl
        ? await stageCover(coverUrl, workPlacementOf(current.metaPath).mediaRoot, requireRoot())
        : null;
      if (coverUrl && !cover) return "skipped";

      let wrote = false;
      let verified: ReturnType<typeof mutateVerifiedMetaSource>;
      try {
        verified = mutateVerifiedMetaSource(catalog, workId, (source) => {
          const diff = computeMissingDiff(
            {
              tags: source.meta.tags,
              urls: source.meta.urls,
              cover: coverStub(source.meta.coverImage ?? null),
            },
            info,
          );
          const patch = buildDlsiteMissingApplyPatch(
            { tags: source.meta.tags, urls: source.meta.urls, dlsite: source.meta.dlsite },
            info,
            diff,
          );
          if (!patch) return source.bytes;
          wrote = true;
          const applied = diff.applyCover ? cover : null;
          applied?.commit();
          return applyDlsiteMergeToRaw(source.bytes, {
            ...patch,
            coverImage: applied?.fileName,
          });
        });
      } finally {
        cover?.discard();
      }
      if (!verified) return "missing";
      if (!wrote) return "skipped";
      const projected = await projectVerifiedSource(scanner, verified);
      return projected.projection.status === "published" ? "applied" : "pending";
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
