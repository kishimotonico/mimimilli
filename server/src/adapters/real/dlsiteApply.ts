import {
  applyDlsiteStatePatch,
  computeMissingDiff,
  dedupeTags,
  mergeAppliedDlsiteTags,
  workMediaRoot,
  type DlsiteApplyBody,
  type DlsiteStateUpdateBody,
  type DlsiteWorkInfo,
  type NormalizedTag,
  type WorkSourceMutationResult,
} from "@mimimilli/shared";
import { MetaMutationReject, encodeMetaRaw } from "./meta.ts";
import { SourceChangedError } from "../../errors.ts";
import { toMetaDlsiteState } from "./dlsiteProjection.ts";
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
    dlsite: ReturnType<typeof toMetaDlsiteState>;
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
  const { catalog, scanner, fetch } = deps;
  const { cachedCover, measureDownloadedCover } = fetch;

  async function persistVerified(
    verified: ReturnType<typeof mutateVerifiedMetaSource>,
  ): Promise<WorkSourceMutationResult | null> {
    if (!verified) return null;
    return { snapshot: await projectVerifiedSource(scanner, verified) };
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

      let coverImage: string | undefined;
      if (body.applyCover && body.info.coverUrl) {
        const mediaRoot = workMediaRoot(current.physicalPath);
        coverImage = await cachedCover(body.info.coverUrl, mediaRoot, signal);
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
        const cover = await measureDownloadedCover(mediaRoot, coverImage);
        if (!cover) return null;
        throwIfAborted(signal, "DLsite一括取得はキャンセルされました");
      }

      throwIfAborted(signal, "DLsite一括取得はキャンセルされました");

      return persistVerified(
        mutateVerifiedMetaSource(catalog, workId, (source) => {
          if (source.sourceRevision !== body.sourceRevision) {
            return new MetaMutationReject(new SourceChangedError());
          }
          const { applyTags } = body;
          return applyDlsiteMergeToRaw(source.bytes, {
            title: body.applyTitle && body.info.title ? body.info.title : undefined,
            tags:
              applyTags.length > 0
                ? mergeAppliedDlsiteTags(source.meta.tags, applyTags)
                : undefined,
            urls:
              body.applyUrl && body.info.url
                ? [
                    ...source.meta.urls.filter((entry) => !entry.url.includes("dlsite.com")),
                    { label: "DLsite", url: body.info.url },
                  ]
                : undefined,
            coverImage,
            dlsite: toMetaDlsiteState({
              rjCode: body.info.rjCode,
              status: "applied",
              lastAttemptAt: null,
              error: null,
              errorKind: null,
              appliedTags: dedupeTags([...source.meta.dlsite.appliedTags, ...applyTags]),
            }),
          });
        }),
      );
    },

    async applyDlsiteMissingItem(
      workId: string,
      info: DlsiteWorkInfo,
    ): Promise<"applied" | "skipped" | "missing"> {
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

      let coverImage: string | undefined;
      if (planned.applyCover && info.coverUrl) {
        const mediaRoot = workMediaRoot(current.physicalPath);
        coverImage = await cachedCover(info.coverUrl, mediaRoot);
        const cover = await measureDownloadedCover(mediaRoot, coverImage);
        if (!cover) return "skipped";
      }

      let wrote = false;
      const verified = mutateVerifiedMetaSource(catalog, workId, (source) => {
        const diff = computeMissingDiff(
          {
            tags: source.meta.tags,
            urls: source.meta.urls,
            cover: coverStub(source.meta.coverImage ?? null),
          },
          info,
        );
        if (diff.newTags.length === 0 && !diff.applyCover && !diff.applyUrl) {
          return source.bytes;
        }
        wrote = true;
        return applyDlsiteMergeToRaw(source.bytes, {
          tags:
            diff.newTags.length > 0
              ? mergeAppliedDlsiteTags(source.meta.tags, diff.newTags)
              : undefined,
          urls:
            diff.applyUrl && info.url
              ? [
                  ...source.meta.urls.filter((entry) => !entry.url.includes("dlsite.com")),
                  { label: "DLsite", url: info.url },
                ]
              : undefined,
          coverImage: diff.applyCover ? coverImage : undefined,
          dlsite: toMetaDlsiteState({
            ...source.meta.dlsite,
            rjCode: info.rjCode,
            status: "applied",
            lastAttemptAt: null,
            error: null,
            errorKind: null,
            appliedTags: dedupeTags([...source.meta.dlsite.appliedTags, ...diff.newTags]),
          }),
        });
      });
      if (!verified) return "missing";
      if (!wrote) return "skipped";
      await projectVerifiedSource(scanner, verified);
      return "applied";
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
          const dlsite = toMetaDlsiteState(applyDlsiteStatePatch(source.meta.dlsite, patch));
          const raw = JSON.parse(source.bytes.toString("utf-8")) as Record<string, unknown>;
          raw.dlsite = dlsite;
          return encodeMetaRaw(raw);
        }),
      );
    },
  };
}
